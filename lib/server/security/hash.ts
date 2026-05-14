import { createHmac } from 'crypto'

export function canonicalJson(value: unknown) {
  return JSON.stringify(value, (_key, currentValue) => {
    if (currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
      return Object.keys(currentValue as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (currentValue as Record<string, unknown>)[key]
          return acc
        }, {})
    }

    return currentValue
  })
}

export function createPayloadHash(input: {
  userId: string
  workflowId: string
  stepKey: string
  attemptNumber: number
  payload: unknown
}) {
  const secret = process.env.APP_HASH_SECRET
  if (!secret) throw new Error('APP_HASH_SECRET is required for workflow payload hashing.')
  const message = canonicalJson({
    userId: input.userId,
    workflowId: input.workflowId,
    stepKey: input.stepKey,
    attemptNumber: input.attemptNumber,
    payload: input.payload,
  })
  return createHmac('sha256', secret).update(message).digest('hex')
}
