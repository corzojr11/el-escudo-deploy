export const passwordRequirements = [
  { label: "12 caracteres o más", test: (value: string) => value.length >= 12 },
  { label: "Una mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Una minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un número", test: (value: string) => /\d/.test(value) },
  { label: "Un símbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export function getPasswordStrength(value: string) {
  return passwordRequirements.filter((requirement) => requirement.test(value)).length;
}

export function isStrongPassword(value: string) {
  return getPasswordStrength(value) === passwordRequirements.length;
}
