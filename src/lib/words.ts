const words = [
  "apple", "breeze", "coral", "daisy", "ember", "frost", "glade", "honey",
  "ivory", "jade", "koala", "lime", "mango", "noble", "olive", "pearl",
  "quartz", "raven", "sable", "tiger", "umber", "vivid", "wisp", "yield",
  "bloom", "crane", "drake", "elite", "flint", "grape", "haven", "iris",
]

export function randomWords(count: number): string[] {
  const result: string[] = []
  const available = [...words]
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * available.length)
    result.push(available[idx])
    available.splice(idx, 1)
  }
  return result
}
