// Déclaration de type minimale pour nspell (pas de types fournis par le package).
declare module "nspell" {
  interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean; forbidden: boolean; warn: boolean };
    add(word: string, model?: string): NSpellInstance;
    remove(word: string): NSpellInstance;
    wordCharacters(): string[] | undefined;
    dictionary(dic: string | Buffer): NSpellInstance;
    personal(dic: string | Buffer): NSpellInstance;
  }
  interface Dictionary {
    aff: string | Buffer | Uint8Array;
    dic: string | Buffer | Uint8Array;
  }
  function nspell(dictionary: Dictionary): NSpellInstance;
  function nspell(aff: string | Buffer | Uint8Array, dic?: string | Buffer | Uint8Array): NSpellInstance;
  export default nspell;
}
