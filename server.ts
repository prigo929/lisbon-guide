import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface WebSource {
  title: string;
  uri: string;
}

function extractGroundingSources(response: any): WebSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: WebSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ title: title || uri, uri });
    }
  }
  return sources.slice(0, 8);
}

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

// Provide Maps API key to client SDK if injected into server env
app.get('/api/maps-config', (_req, res) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({ apiKey });
});

// Google Maps Platform Weather API (currentConditions:lookup)
app.get('/api/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
    }
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!mapsKey) {
      return res.status(503).json({ error: 'Google Maps API key is not available on the server.' });
    }

    const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
    url.searchParams.append('key', mapsKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));
    url.searchParams.append('unitsSystem', 'METRIC');

    const weatherRes = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });

    const data: any = await weatherRes.json().catch(() => ({}));
    if (weatherRes.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({
        error: 'Google Maps Platform Weather API quota reached.',
        quotaExceeded: true,
      });
    }
    if (!weatherRes.ok) {
      return res.status(weatherRes.status).json({
        error: data?.error?.message || `Weather lookup failed (${weatherRes.status}).`,
      });
    }

    return res.json({
      condition: data?.weatherCondition?.description?.text || 'Clear',
      conditionType: data?.weatherCondition?.type || 'CLEAR',
      temperatureC: data?.temperature?.degrees ?? null,
      feelsLikeC: data?.feelsLikeTemperature?.degrees ?? null,
      humidity: data?.relativeHumidity ?? null,
      windKmh: data?.wind?.speed?.value ?? null,
      rainChance: data?.precipitation?.probability?.percent ?? null,
      uvIndex: data?.uvIndex ?? null,
      isDaytime: data?.isDaytime ?? true,
      updatedAt: data?.currentTime || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Weather API error:', err);
    return res.status(500).json({ error: err?.message || 'Unable to fetch weather conditions.' });
  }
});

// Turn natural-language Lisbon student request into a Places API (New) text query
app.post('/api/ai/map-query', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a search query.' });
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `The user is an Erasmus architecture student at ISCTE (Av. das Forças Armadas, Entrecampos, Lisbon) who speaks no Portuguese.
Convert their request into an optimal Google Places text search query centered on Lisbon, plus a concise 1-2 sentence local tip. Do NOT invent specific unverified business names unless the user named one; keep the searchQuery clean and effective for Google Places searchByText in Lisbon.

User request: "${prompt.trim()}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            searchQuery: {
              type: Type.STRING,
              description: 'Concise Google Places text search query in Lisbon, Portugal.',
            },
            studioNote: {
              type: Type.STRING,
              description: 'Practical 1-2 sentence tip for an ISCTE architecture student in Lisbon.',
            },
            suggestedTravelMode: {
              type: Type.STRING,
              description: 'Either WALKING or TRANSIT based on likely distance from Entrecampos.',
            },
          },
          required: ['searchQuery', 'studioNote', 'suggestedTravelMode'],
        },
      },
    });

    const parsed = parseJsonSafe(response.text, {
      searchQuery: `${prompt.trim()} Lisbon`,
      studioNote: 'Showing live Google Places results around Lisbon relative to ISCTE Entrecampos.',
      suggestedTravelMode: 'TRANSIT',
    });

    return res.json(parsed);
  } catch (err: any) {
    console.error('Map query AI error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to interpret map search.' });
  }
});

// Housing & Neighborhood Analyzer with live Google Search grounding
app.post('/api/ai/housing-analyze', async (req, res) => {
  try {
    const { areaName, listingText, commuteSummary } = req.body as {
      areaName?: string;
      listingText?: string;
      commuteSummary?: string;
    };
    if (!areaName?.trim() && !listingText?.trim()) {
      return res.status(400).json({ error: 'Provide a Lisbon neighborhood or rental listing text.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are an architectural urbanism and Erasmus housing advisor for a student attending ISCTE – School of Technology and Architecture (Av. das Forças Armadas, Entrecampos, Lisbon, Yellow Metro Line) who speaks ZERO Portuguese.

Analyze the following Lisbon neighborhood and/or pasted Portuguese rental listing using up-to-date information from Google Search:
- Target area / address: ${areaName || 'Not specified'}
- Measured commute to ISCTE: ${commuteSummary || 'Will be checked via Maps'}
- Pasted rental listing or lease notes: ${listingText || 'None provided'}

Return a concise, well-structured response in valid JSON ONLY (no extra markdown outside JSON) with these exact keys:
{
  "headline": "Short editorial summary of living here as an ISCTE architecture student",
  "typicalStudentRent": "Current realistic monthly room rent range in EUR (e.g. €480–€650/month)",
  "hillinessAndWalkability": "Honest note on Lisbon hills, pavement, and walking comfort",
  "commuteAndTransit": "Specific metro line (Yellow/Green/Red/Blue), bus, or train notes for reaching ISCTE Entrecampos",
  "neighborhoodVibe": "2-3 sentences on architecture character, student life, cafes, and supermarkets (Pingo Doce, Continente, Lidl)",
  "leaseRedFlags": ["3-5 concrete Portuguese rental checks or decoded clauses from the pasted listing, e.g. despesas incluídas, caução, contrato registado nas Finanças, recibos"],
  "questionsForLandlordPt": [
    { "english": "Are bills (water, electricity, internet) included?", "portuguese": "As despesas (água, luz e internet) estão incluídas?" }
  ]
}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const parsed = parseJsonSafe(response.text, {
      headline: areaName ? `Student Housing Notes: ${areaName}` : 'Lisbon Rental Listing Review',
      typicalStudentRent: '€450–€680 / room (verify utilities)',
      hillinessAndWalkability: response.text?.slice(0, 320) || 'Check street elevation in Street View before committing.',
      commuteAndTransit: 'Verify direct Yellow Line (Entrecampos) or train access to ISCTE.',
      neighborhoodVibe: 'Use Street View and local Google Places to inspect nearby grocery stores and evening lighting.',
      leaseRedFlags: [
        'Confirm whether despesas (water, electricity, gas, Wi-Fi) are included in the monthly rent.',
        'Ask if the contract is registered with Finanças (contrato registado) so you can get rent receipts (recibos).',
        'Never transfer a deposit (caução) before viewing the flat in person or via a verified video tour.',
      ],
      questionsForLandlordPt: [
        {
          english: 'Are utilities and Wi-Fi included in the rent?',
          portuguese: 'As despesas e a internet estão incluídas na renda?',
        },
      ],
    });

    return res.json({
      ...parsed,
      sources: extractGroundingSources(response),
    });
  } catch (err: any) {
    console.error('Housing analyze error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to analyze neighborhood or listing.' });
  }
});

// Weekend Trip & Beach Planner with live Google Search grounding + structured ICS schedule
app.post('/api/ai/trip-plan', async (req, res) => {
  try {
    const { destination, duration, budgetEur, weatherSummary, transitSummary } = req.body as {
      destination?: string;
      duration?: string;
      budgetEur?: number;
      weatherSummary?: string;
      transitSummary?: string;
    };
    if (!destination?.trim()) {
      return res.status(400).json({ error: 'Destination is required.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are planning a budget-friendly Erasmus trip from Lisbon (ISCTE / Entrecampos) for an architecture student who speaks no Portuguese.
Use Google Search to check current Portuguese train/bus options (CP Comboios de Portugal, Fertagus, Carris Metropolitana, Navegante pass coverage if applicable, or FlixBus/Rede Expressos), ticket costs, and student discounts.

Trip request:
- Destination: ${destination.trim()}
- Duration: ${duration || 'Full day trip'}
- Target budget per student: €${budgetEur || 30}
- Current weather snapshot: ${weatherSummary || 'Check forecast'}
- Transit estimate: ${transitSummary || 'From Lisbon Entrecampos / Rossio / Cais do Sodré'}

Return valid JSON ONLY (no prose outside JSON) with this exact structure:
{
  "title": "Concise architectural monograph trip title",
  "transportBrief": "Exact station in Lisbon, train/bus line, Navegante card applicability, and approximate round-trip ticket cost",
  "architectureHighlight": "1-2 sentences on what an architecture student should observe (materials, landscape, urbanism, or historic structures)",
  "estimatedCostEur": "Realistic student total breakdown (e.g. €18–€26 per person)",
  "packingTip": "Short practical tip considering weather, Atlantic wind, or hills",
  "schedule": [
    {
      "time": "09:15",
      "durationMinutes": 60,
      "title": "Step title",
      "location": "Station or landmark name",
      "notes": "Concise tip including student discount or food note"
    }
  ]
}
Include 5 to 6 realistic chronological schedule items with 24h HH:MM times so the student can export them directly to iPhone Apple Calendar (.ics).`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const parsed = parseJsonSafe(response.text, {
      title: `${destination.trim()} Erasmus Field Trip`,
      transportBrief: 'Check CP Comboios de Portugal or Carris Metropolitana schedules from Entrecampos, Rossio, or Cais do Sodré.',
      architectureHighlight: 'Bring a sketchbook and observe the transition between coastal geology, vernacular masonry, and modern interventions.',
      estimatedCostEur: `€${budgetEur || 30} approx.`,
      packingTip: 'Bring a light windbreaker for Atlantic breezes and comfortable walking shoes.',
      schedule: [
        {
          time: '09:30',
          durationMinutes: 60,
          title: `Depart Lisbon for ${destination.trim()}`,
          location: 'Lisbon Central Station / Entrecampos',
          notes: 'Tap your Navegante card or purchase a return student ticket.',
        },
        {
          time: '11:00',
          durationMinutes: 120,
          title: 'Architectural Walk & Historic Core',
          location: destination.trim(),
          notes: 'Explore key facades, squares, and viewpoints.',
        },
        {
          time: '13:30',
          durationMinutes: 75,
          title: 'Budget Tasca Lunch',
          location: destination.trim(),
          notes: 'Look for prato do dia (dish of the day) for €9–€13.',
        },
        {
          time: '15:30',
          durationMinutes: 120,
          title: 'Coastline / Landscape Study',
          location: destination.trim(),
          notes: 'Afternoon light study and break with friends.',
        },
        {
          time: '18:30',
          durationMinutes: 60,
          title: 'Return Transit to Lisbon',
          location: 'Main Station',
          notes: 'Aim to catch a train before evening peak gaps.',
        },
      ],
    });

    return res.json({
      ...parsed,
      sources: extractGroundingSources(response),
    });
  } catch (err: any) {
    console.error('Trip plan error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate trip itinerary.' });
  }
});

// Zero-Portuguese Camera Photo & Text Decoder (Menus, Leases, Signs, Utility Bills)
app.post('/api/ai/decode-pt', async (req, res) => {
  try {
    const { imageBase64, mimeType, text, context } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      text?: string;
      context?: string;
    };

    if (!imageBase64 && !text?.trim()) {
      return res.status(400).json({ error: 'Upload a photo or paste Portuguese text to decode.' });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }
    parts.push({
      text: `You are helping an Erasmus architecture student in Lisbon who speaks ZERO Portuguese decode a real-world Portuguese item (restaurant menu, street sign, rental contract/lease clause, utility bill, print shop price list, or university notice).
Context hint: ${context || 'Auto-detect'}
${text?.trim() ? `Pasted Portuguese text:\n"""\n${text.trim()}\n"""` : 'Read all visible Portuguese text from the attached photo carefully.'}

Explain clearly in plain English, flag any Lisbon/Portugal-specific cultural or legal gotchas (for example: couvert bread/olives charged extra at restaurants, prato do dia value, caução deposit rules, despesas not included, IVA tax, or student discounts), and give 2–3 polite European Portuguese (Lisbon pt-PT) phrases the student can say or show in response.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedType: {
              type: Type.STRING,
              description: 'Category detected: e.g. Tasca Menu, Rental Lease, Street Sign, Utility Bill, Print Shop.',
            },
            originalSummary: {
              type: Type.STRING,
              description: 'Key Portuguese text or headline extracted.',
            },
            englishTranslation: {
              type: Type.STRING,
              description: 'Clear, complete English translation and breakdown.',
            },
            lisbonGotchas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Important Portugal-specific pricing, legal, or etiquette notes.',
            },
            actionAdvice: {
              type: Type.STRING,
              description: 'Practical next step for the student.',
            },
            replyPhrases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  portuguese: { type: Type.STRING },
                  english: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                },
                required: ['portuguese', 'english', 'phonetic'],
              },
            },
          },
          required: [
            'detectedType',
            'originalSummary',
            'englishTranslation',
            'lisbonGotchas',
            'actionAdvice',
            'replyPhrases',
          ],
        },
      },
    });

    const parsed = parseJsonSafe(response.text, null);
    if (!parsed) {
      return res.status(502).json({ error: 'Could not parse translation output. Please try a clearer photo or text.' });
    }
    return res.json(parsed);
  } catch (err: any) {
    console.error('Decode PT error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to decode Portuguese content.' });
  }
});

// Translate custom English sentence into natural European Portuguese (Lisbon pt-PT)
app.post('/api/ai/translate-phrase', async (req, res) => {
  try {
    const { english, situation } = req.body as { english?: string; situation?: string };
    if (!english?.trim()) {
      return res.status(400).json({ error: 'Enter what you want to say in English.' });
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Translate this into natural, polite European Portuguese as spoken in Lisbon (pt-PT, NOT Brazilian Portuguese) for a university Erasmus student.
Situation: ${situation || 'Everyday Lisbon life'}
English: "${english.trim()}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            portuguese: { type: Type.STRING, description: 'Natural Lisbon European Portuguese phrase.' },
            phonetic: { type: Type.STRING, description: 'Easy English-speaker phonetic guide for Lisbon pronunciation.' },
            culturalNote: { type: Type.STRING, description: 'Short 1-sentence politeness or usage note in Lisbon.' },
          },
          required: ['portuguese', 'phonetic', 'culturalNote'],
        },
      },
    });

    const parsed = parseJsonSafe(response.text, null);
    if (!parsed) {
      return res.status(502).json({ error: 'Unable to translate phrase.' });
    }
    return res.json(parsed);
  } catch (err: any) {
    console.error('Translate phrase error:', err);
    return res.status(500).json({ error: err?.message || 'Translation failed.' });
  }
});

function wrapPcmAsWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Spoken European Portuguese Audio via Gemini TTS (gemini-3.8-flash-lite-tts)
app.post('/api/ai/speak-pt', async (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Portuguese text is required for speech synthesis.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: 'Clear, natural European Portuguese speaker from Lisbon, calm and articulate pace for a beginner',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((p: any) => p?.inlineData?.data);
    const inlineData = audioPart?.inlineData;
    if (!inlineData?.data) {
      return res.status(502).json({ error: 'Speech model returned no audio data.' });
    }

    const rawBuffer = Buffer.from(inlineData.data, 'base64');
    const rawMime = String(inlineData.mimeType || '').toLowerCase();

    const isEncodedContainer =
      rawMime.includes('mpeg') ||
      rawMime.includes('mp3') ||
      rawMime.includes('ogg') ||
      rawMime.includes('mp4') ||
      rawMime.includes('webm');
    const hasRiffHeader =
      rawBuffer.length >= 12 &&
      rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      rawBuffer.subarray(8, 12).toString('ascii') === 'WAVE';

    if (isEncodedContainer || hasRiffHeader) {
      return res.json({
        audioBase64: rawBuffer.toString('base64'),
        mimeType: hasRiffHeader ? 'audio/wav' : inlineData.mimeType || 'audio/mpeg',
      });
    }

    // Gemini TTS typically emits headerless 24kHz 16-bit mono PCM (audio/L16;codec=pcm;rate=24000).
    // Wrap in a standard 44-byte RIFF/WAVE header so iPhone Safari & Chrome decode it natively.
    const rateMatch = rawMime.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
    const wavBuffer = wrapPcmAsWav(rawBuffer, sampleRate, 1, 16);

    return res.json({
      audioBase64: wavBuffer.toString('base64'),
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to synthesize Portuguese audio.' });
  }
});

// Live Google Search verification for Lisbon Erasmus bureaucracy steps
app.post('/api/ai/bureaucracy-check', async (req, res) => {
  try {
    const { topic, detail } = req.body as { topic?: string; detail?: string };
    if (!topic?.trim()) {
      return res.status(400).json({ error: 'Bureaucracy topic is required.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are verifying the latest official rules in Portugal (Lisbon) for an incoming Erasmus student at ISCTE – Instituto Universitário de Lisboa.
Topic: ${topic.trim()}
Context: ${detail || 'Student arriving for one semester in Lisbon'}

Use Google Search to verify current procedures, current fees or free student eligibility (e.g., Navegante Sub23 / Navegante Estudante, NIF at Finanças / Loja de Cidadão, CRUE at Câmara Municipal de Lisboa, or Portuguese eSIM/SIM cards).
Return concise valid JSON ONLY:
{
  "summary": "2-3 sentences explaining the exact current process in Lisbon.",
  "currentFeesOrEligibility": "Up-to-date cost or student discount status.",
  "latestSteps": ["3-5 concrete, current action steps in order"]
}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const parsed = parseJsonSafe(response.text, {
      summary: response.text?.trim() || 'Verified latest Portuguese student procedure.',
      currentFeesOrEligibility: 'Check the linked official Portuguese portal below for exact current fees.',
      latestSteps: [
        'Bring passport/EU ID and your ISCTE Erasmus acceptance letter (Carta de Aceitação).',
        'Check appointment requirements on the official portal before queuing.',
      ],
    });

    return res.json({
      ...parsed,
      verifiedAt: new Date().toISOString(),
      sources: extractGroundingSources(response),
    });
  } catch (err: any) {
    console.error('Bureaucracy check error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to verify latest Lisbon rules.' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Caderno Lisboa server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
