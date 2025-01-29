export class CookieHelper {
  static get(name: string): string | null {
    const cookie = document.cookie.split('; ').find(row => row.startsWith(`${name}=`));
    return cookie?.split('=')?.[1] ?? null;
  }

  static exists(name: string): boolean {
    return document.cookie.split('; ').some(row => row.startsWith(`${name}=`));
  }
}
