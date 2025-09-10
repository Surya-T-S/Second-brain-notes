import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { message, skill } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Concise by default; allow detail only if user explicitly asks
    const lowerMsg: string = String(message).toLowerCase();
    const wantsDetail = /(detailed|explain|why|how|step by step|in depth|elaborate|long)/.test(lowerMsg);

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: wantsDetail ? 0.3 : 0.15,
        topP: 0.9,
        maxOutputTokens: wantsDetail ? 512 : 220,
      },
    });

    let systemPrompt = '';
    
    switch (skill) {
      case 'expand':
        systemPrompt = [
          'Give exactly 3 bullet points with direct, practical insights.',
          'No fluff, no preamble, no conclusion.',
          'Avoid hedging words (maybe, might, could).',
        ].join('\n');
        break;
      case 'summarize':
        systemPrompt = [
          'Return 2–4 concise bullet points capturing only essentials.',
          'No intro text. No disclaimers. No repetition.',
        ].join('\n');
        break;
      case 'extract_actions':
        systemPrompt = [
          'Return only action items, each starting with "•" in imperative mood.',
          'Be concrete and specific. No explanations unless explicitly asked.',
        ].join('\n');
        break;
      default:
        systemPrompt = [
          'Answer in 1–3 short sentences or 2–4 bullets.',
          'Be bluntly clear and specific. No hedging, no prefaces.',
        ].join('\n');
    }

    const prompt = `${systemPrompt}\n\nUser message:\n${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text();

    // Normalize output to be concise and formatted per the requested skill
    const normalize = (input: string): string[] => {
      const lines = input
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      // Strip common prefaces
      const stripped = lines.filter(l => !/^(here(\'s| is| are)|sure,|certainly,|as an ai)/i.test(l));
      return stripped.length ? stripped : lines;
    };

    const bulletsOnly = (items: string[], max: number): string[] => {
      const result: string[] = [];
      for (const l of items) {
        const content = l.replace(/^[-*•\d.\)\s]+/, '').trim();
        if (!content) continue;
        result.push(`• ${content}`);
        if (result.length >= max) break;
      }
      return result;
    };

    let finalText = raw.trim();
    const lines = normalize(finalText);
    if (skill === 'expand') {
      finalText = bulletsOnly(lines, 3).join('\n');
    } else if (skill === 'summarize') {
      finalText = bulletsOnly(lines, 4).join('\n');
    } else if (skill === 'extract_actions') {
      finalText = bulletsOnly(lines, 8).join('\n');
    } else {
      // Default: keep 1–3 sentences or first 3 bullets
      const bullets = bulletsOnly(lines, 3);
      if (bullets.length) {
        finalText = bullets.join('\n');
      } else {
        finalText = lines.join(' ').split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
      }
    }

    return NextResponse.json({ response: finalText });
  } catch (error) {
    console.error('Error in AI API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
}
