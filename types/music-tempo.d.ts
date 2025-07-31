declare module "music-tempo" {
  export default class MusicTempo {
    constructor(audioData: number[]);
    tempo: number | null;
  }
}
