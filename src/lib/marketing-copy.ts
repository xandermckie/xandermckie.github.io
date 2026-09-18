export interface HomePitch {
  headline: string;
  paragraphs: readonly string[];
}

export function homePitch(languageName: string): HomePitch {
  return {
    headline: "So you aren't just pushing AI slop.",
    paragraphs: [
      `This is supposed to be an easy way to get the concepts behind ${languageName} into your head. When you use AI to support you at a job, you shouldn't just be pushing slop. You should actually be able to break down what is going on, stay productive, and not risk breaking something because you didn't know what you shipped.`,
      "It's a passive learning system. It doesn't take much time, and you don't have to spend hours ripping every line apart. Just get some reps in, keep it fun, and sprinkle in a little more understanding day after day.",
    ],
  };
}

export const PRICING_WHY =
  'The whole point is to make the language feel approachable. Short sessions, real code, a quiz and a breakdown after. Enough that you can use AI at work without going in blind, not so much that it eats your night. Pro takes the daily cap off so you can keep getting reps in.';
