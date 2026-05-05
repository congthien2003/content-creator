import { GoogleGenerativeAI } from '@google/generative-ai'
import { OpenRouter } from '@openrouter/sdk'

type AIProvider = 'gemini' | 'openrouter'

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase()
  if (provider === 'openrouter') return 'openrouter'
  return 'gemini'
}

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Thiếu GOOGLE_GEMINI_API_KEY trong biến môi trường.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function generateWithOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('Thiếu OPENROUTER_API_KEY trong biến môi trường.')
  }

  const client = new OpenRouter({
    apiKey,
  })

  const completion = await client.chat.send({
    chatRequest: {
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-5.2',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
  })

  const content = completion.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenRouter trả về nội dung rỗng.')
  }

  if (typeof content === 'string') return content
  return JSON.stringify(content)
}

export async function generateText(prompt: string): Promise<string> {
  const provider = getProvider()
  if (provider === 'openrouter') {
    return generateWithOpenRouter(prompt)
  }
  return generateWithGemini(prompt)
}
