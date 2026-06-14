export const LIMITS = {
  email: 254,
  password: { min: 8, max: 72 },
  username: { min: 2, max: 31 },
  displayName: 60,
  bio: 300,
  websiteUrl: 200,
  socialUrl: 200,
  title: 150,
  content: 8000,
  githubUrl: 500,
  tagsInput: 200,
  maxTags: 10,
  tagLength: 30,
  comment: 1000,
};

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidGithubUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.hostname === 'github.com' || url.hostname === 'www.github.com')
    );
  } catch {
    return false;
  }
}

export function isValidYoutubeUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.hostname === 'youtube.com' ||
        url.hostname === 'www.youtube.com' ||
        url.hostname === 'youtu.be')
    );
  } catch {
    return false;
  }
}

export function isValidTwitchUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.hostname === 'twitch.tv' || url.hostname === 'www.twitch.tv')
    );
  } catch {
    return false;
  }
}

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,30}$/;

export function validateUsername(value: string): string | null {
  const clean = value.trim().toLowerCase();
  if (clean.length < LIMITS.username.min)
    return `Имя пользователя: минимум ${LIMITS.username.min} символа`;
  if (clean.length > LIMITS.username.max)
    return `Имя пользователя: максимум ${LIMITS.username.max} символов`;
  if (!USERNAME_REGEX.test(clean))
    return 'Имя пользователя: строчные буквы/цифры/-/_, начинается с буквы или цифры';
  return null;
}
