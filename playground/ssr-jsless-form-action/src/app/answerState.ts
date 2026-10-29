let lastAnswer: string | undefined;

export function readLastAnswer() {
  return lastAnswer;
}

export function recordAnswer(answer: string) {
  lastAnswer = answer;
}
