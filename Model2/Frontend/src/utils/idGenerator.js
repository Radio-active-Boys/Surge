let counter = 1;
export function generateId() {
  const ts = Date.now();
  return `${ts}-${counter++}`;
}