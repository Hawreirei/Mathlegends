/**
 * Where "back" goes (#44). Pure TypeScript, no Phaser.
 *
 * One rule table for the phone's Back button, the browser's back button and Esc on a keyboard,
 * so there is never a dead end: every screen has a way back, and only the Menu leaves the game.
 * Inside a match, Back first closes what is open (shop, quit question), then asks before quitting.
 */
export type Screen =
  | 'menu'
  | 'settings'
  | 'settingsTransfer'
  | 'placementIntro'
  | 'placementQuiz'
  | 'placementDone'
  | 'match'
  | 'matchShop'
  | 'matchQuitConfirm'
  | 'result';

export type BackAction =
  /** Let the browser leave the game (only from the Menu). */
  | { kind: 'leave' }
  /** Go to another scene. */
  | { kind: 'scene'; to: 'Menu' | 'Settings' }
  /** Close an overlay or sub-page and stay. */
  | { kind: 'close' }
  /** Ask "quit this match?" (it counts as a loss). */
  | { kind: 'askQuit' };

export function backAction(screen: Screen): BackAction {
  switch (screen) {
    case 'menu':
      return { kind: 'leave' };
    case 'settingsTransfer':
    case 'matchShop':
    case 'matchQuitConfirm':
      return { kind: 'close' };
    case 'match':
      return { kind: 'askQuit' };
    case 'settings':
    case 'placementIntro':
    case 'placementQuiz':
    case 'placementDone':
    case 'result':
      return { kind: 'scene', to: 'Menu' };
  }
}

/** Every screen and the ways forward from it (buttons), for the no-dead-ends test. */
export const EXITS: Record<Screen, readonly Screen[]> = {
  menu: ['placementIntro', 'match', 'settings'],
  settings: ['menu', 'settingsTransfer', 'placementIntro'],
  settingsTransfer: ['settings'],
  placementIntro: ['placementQuiz', 'menu'],
  placementQuiz: ['placementDone', 'menu'],
  placementDone: ['match'],
  match: ['matchShop', 'matchQuitConfirm', 'result'],
  matchShop: ['match'],
  matchQuitConfirm: ['match', 'result'],
  result: ['match', 'menu'],
};
