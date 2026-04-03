function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateTimeUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear();
  const month = pad(parsed.getUTCMonth() + 1);
  const day = pad(parsed.getUTCDate());
  const hours = pad(parsed.getUTCHours());
  const minutes = pad(parsed.getUTCMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function formatTimeUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const hours = pad(parsed.getUTCHours());
  const minutes = pad(parsed.getUTCMinutes());
  const seconds = pad(parsed.getUTCSeconds());
  return `${hours}:${minutes}:${seconds} UTC`;
}

export function nowTimeUtcLabel(): string {
  return formatTimeUtc(new Date().toISOString());
}

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
