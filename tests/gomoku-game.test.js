import { describe, expect, it } from 'vitest';

import { GOMOKU_STATUS, PLAYER, REJECTION } from '../src/js/gomoku/constants.js';
import { GomokuGame } from '../src/js/gomoku/gomoku-game.js';
import { playMoves } from './helpers/play-gomoku.js';

describe('GomokuGame — initial state', () => {
  it('starts on an empty 15×15 board with black to move', () => {
    const game = new GomokuGame();

    expect(game.size).toBe(15);
    expect(game.winLength).toBe(5);
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
    expect(game.winner).toBeNull();
    expect(game.winningLine).toBeNull();
    expect(game.moves).toHaveLength(0);
    expect(game.freeCellCount).toBe(225);
    expect(game.isFinished).toBe(false);
  });

  it('reports every intersection as empty and legal', () => {
    const game = new GomokuGame({ size: 5, winLength: 4 });

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        expect(game.cellAt(x, y)).toBeNull();
        expect(game.isLegalMove(x, y)).toBe(true);
      }
    }
  });

  it('honours a configured opening colour', () => {
    const game = new GomokuGame({ firstPlayer: PLAYER.WHITE });

    expect(game.firstPlayer).toBe(PLAYER.WHITE);
    expect(game.currentPlayer).toBe(PLAYER.WHITE);
    expect(game.place(7, 7).move.player).toBe(PLAYER.WHITE);
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
  });

  it('rejects invalid options', () => {
    expect(() => new GomokuGame({ size: 0 })).toThrow(RangeError);
    expect(() => new GomokuGame({ size: 15.5 })).toThrow(RangeError);
    expect(() => new GomokuGame({ winLength: 1 })).toThrow(RangeError);
    expect(() => new GomokuGame({ size: 4, winLength: 5 })).toThrow(RangeError);
    expect(() => new GomokuGame({ firstPlayer: 'red' })).toThrow(RangeError);
  });
});

describe('GomokuGame — placing stones', () => {
  it('alternates colours and records the history', () => {
    const game = new GomokuGame();

    const first = game.place(7, 7);
    const second = game.place(8, 7);

    expect(first.placed).toBe(true);
    expect(first.move).toEqual({ x: 7, y: 7, player: PLAYER.BLACK, index: 0 });
    expect(second.move).toEqual({ x: 8, y: 7, player: PLAYER.WHITE, index: 1 });
    expect(game.cellAt(7, 7)).toBe(PLAYER.BLACK);
    expect(game.cellAt(8, 7)).toBe(PLAYER.WHITE);
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
    expect(game.moveCount).toBe(2);
    expect(game.lastMove).toBe(second.move);
    expect(game.freeCellCount).toBe(223);
  });

  it('refuses an occupied intersection without consuming the turn', () => {
    const game = new GomokuGame();
    game.place(3, 3);

    const result = game.place(3, 3);

    expect(result.placed).toBe(false);
    expect(result.rejection).toBe(REJECTION.OCCUPIED);
    expect(game.currentPlayer).toBe(PLAYER.WHITE);
    expect(game.moveCount).toBe(1);
    expect(game.isLegalMove(3, 3)).toBe(false);
  });

  it('refuses coordinates outside the board', () => {
    const game = new GomokuGame();

    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [15, 0],
      [0, 15],
      [1.5, 2],
    ]) {
      const result = game.place(x, y);
      expect(result.placed).toBe(false);
      expect(result.rejection).toBe(REJECTION.OUT_OF_BOUNDS);
      expect(game.isLegalMove(x, y)).toBe(false);
    }

    expect(game.moveCount).toBe(0);
    expect(game.cellAt(-1, 0)).toBeNull();
  });
});

describe('GomokuGame — win detection', () => {
  it('detects a horizontal line and reports its stones in order', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [3, 7],
      [3, 8],
      [4, 7],
      [4, 8],
      [5, 7],
      [5, 8],
      [6, 7],
      [6, 8],
      [7, 7],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.status).toBe(GOMOKU_STATUS.WON);
    expect(game.isFinished).toBe(true);
    expect(game.winningLine).toEqual([
      { x: 3, y: 7 },
      { x: 4, y: 7 },
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
    ]);
  });

  it('detects a vertical line', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [7, 2],
      [8, 2],
      [7, 3],
      [8, 3],
      [7, 4],
      [8, 4],
      [7, 5],
      [8, 5],
      [7, 6],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.winningLine.map((cell) => cell.y)).toEqual([2, 3, 4, 5, 6]);
  });

  it('detects a descending diagonal', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [2, 2],
      [0, 5],
      [3, 3],
      [1, 5],
      [4, 4],
      [2, 5],
      [5, 5],
      [3, 5],
      [6, 6],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.winningLine).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
      { x: 5, y: 5 },
      { x: 6, y: 6 },
    ]);
  });

  it('detects an ascending diagonal', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [2, 10],
      [0, 0],
      [3, 9],
      [1, 0],
      [4, 8],
      [2, 0],
      [5, 7],
      [3, 0],
      [6, 6],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.winningLine).toEqual([
      { x: 2, y: 10 },
      { x: 3, y: 9 },
      { x: 4, y: 8 },
      { x: 5, y: 7 },
      { x: 6, y: 6 },
    ]);
  });

  it('detects a line completed by a gap-filling stone', () => {
    const game = new GomokuGame();
    // Black builds 4-1-4 around the hole at (7, 7) and fills it last.
    const result = playMoves(game, [
      [5, 7],
      [5, 9],
      [6, 7],
      [6, 9],
      [8, 7],
      [7, 9],
      [9, 7],
      [8, 9],
      [7, 7],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.winningLine).toEqual([
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
      { x: 8, y: 7 },
      { x: 9, y: 7 },
    ]);
  });

  it('lets white win as well', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [0, 0],
      [3, 7],
      [1, 0],
      [4, 7],
      [2, 0],
      [5, 7],
      [3, 0],
      [6, 7],
      [5, 0],
      [7, 7],
    ]);

    expect(result.winner).toBe(PLAYER.WHITE);
    expect(game.status).toBe(GOMOKU_STATUS.WON);
  });

  it('treats an overline as a win (freestyle rules)', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [3, 7],
      [3, 9],
      [4, 7],
      [4, 9],
      [5, 7],
      [5, 9],
      [6, 7],
      [6, 9],
      [8, 7],
      [8, 9],
      [7, 7],
    ]);

    expect(result.winner).toBe(PLAYER.BLACK);
    expect(game.winningLine).toHaveLength(6);
  });

  it('does not award a win for four in a row', () => {
    const game = new GomokuGame();
    const result = playMoves(game, [
      [3, 7],
      [3, 8],
      [4, 7],
      [4, 8],
      [5, 7],
      [5, 8],
      [6, 7],
    ]);

    expect(result.winner).toBeNull();
    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
    expect(game.winningLine).toBeNull();
  });

  it('does not join stones of different colours into a line', () => {
    const game = new GomokuGame({ size: 6, winLength: 5 });
    const result = playMoves(game, [
      [0, 0],
      [3, 0],
      [1, 0],
      [4, 0],
      [2, 0],
      [5, 0],
    ]);

    expect(result.winner).toBeNull();
    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
  });

  it('does not wrap a line around the board edge', () => {
    const game = new GomokuGame({ size: 5, winLength: 5 });
    // The five black stones occupy consecutive row-major indices (3…7) but span
    // two rows, so only a board that wrongly ignores the edge sees a line.
    const result = playMoves(game, [
      [3, 0],
      [0, 0],
      [4, 0],
      [1, 0],
      [0, 1],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 1],
    ]);

    expect(result.winner).toBeNull();
    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
  });

  it('refuses further moves once the match is decided', () => {
    const game = new GomokuGame({ size: 5, winLength: 3 });
    playMoves(game, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ]);

    expect(game.winner).toBe(PLAYER.BLACK);

    const result = game.place(4, 4);
    expect(result.placed).toBe(false);
    expect(result.rejection).toBe(REJECTION.FINISHED);
    expect(game.isLegalMove(4, 4)).toBe(false);
    expect(game.cellAt(4, 4)).toBeNull();
  });
});

describe('GomokuGame — draws', () => {
  it('ends in a draw when the board fills up without a line', () => {
    // The classic drawn tic-tac-toe position, which is a 3×3 gomoku with
    // winLength 3 — the smallest board that can be filled without any line.
    const game = new GomokuGame({ size: 3, winLength: 3 });
    const last = playMoves(game, [
      [0, 0],
      [1, 1],
      [2, 0],
      [1, 0],
      [0, 1],
      [2, 1],
      [2, 2],
      [0, 2],
      [1, 2],
    ]);

    expect(last.winner).toBeNull();
    expect(last.draw).toBe(true);
    expect(game.status).toBe(GOMOKU_STATUS.DRAW);
    expect(game.isFinished).toBe(true);
    expect(game.freeCellCount).toBe(0);
  });

  it('refuses further moves after a draw', () => {
    const game = new GomokuGame({ size: 3, winLength: 3 });
    playMoves(game, [
      [0, 0],
      [1, 1],
      [2, 0],
      [1, 0],
      [0, 1],
      [2, 1],
      [2, 2],
      [0, 2],
      [1, 2],
    ]);

    expect(game.place(0, 0).rejection).toBe(REJECTION.FINISHED);

    game.undo();

    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
    expect(game.isLegalMove(1, 2)).toBe(true);
  });
});

describe('GomokuGame — undo and reset', () => {
  it('takes back the last move and returns the turn to its owner', () => {
    const game = new GomokuGame();
    game.place(7, 7);
    game.place(8, 8);

    const undone = game.undo();

    expect(undone).toEqual({ x: 8, y: 8, player: PLAYER.WHITE, index: 1 });
    expect(game.cellAt(8, 8)).toBeNull();
    expect(game.currentPlayer).toBe(PLAYER.WHITE);
    expect(game.moveCount).toBe(1);
    expect(game.isLegalMove(8, 8)).toBe(true);
  });

  it('returns null when there is nothing to take back', () => {
    const game = new GomokuGame();

    expect(game.undo()).toBeNull();
    expect(game.moveCount).toBe(0);
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
  });

  it('reopens a finished match when the winning move is taken back', () => {
    const game = new GomokuGame({ size: 5, winLength: 3 });
    playMoves(game, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ]);

    expect(game.status).toBe(GOMOKU_STATUS.WON);

    game.undo();

    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);
    expect(game.winner).toBeNull();
    expect(game.winningLine).toBeNull();
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
    expect(game.place(2, 0).winner).toBe(PLAYER.BLACK);
  });

  it('unwinds the whole history one move at a time', () => {
    const game = new GomokuGame();
    playMoves(game, [
      [7, 7],
      [8, 8],
      [6, 6],
    ]);

    while (game.undo() !== null) {
      /* keep taking back moves */
    }

    expect(game.moveCount).toBe(0);
    expect(game.freeCellCount).toBe(225);
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
  });

  it('clears the board on reset and can swap the opening colour', () => {
    const game = new GomokuGame();
    playMoves(game, [
      [7, 7],
      [8, 8],
    ]);

    game.reset();

    expect(game.moveCount).toBe(0);
    expect(game.cellAt(7, 7)).toBeNull();
    expect(game.currentPlayer).toBe(PLAYER.BLACK);
    expect(game.status).toBe(GOMOKU_STATUS.PLAYING);

    game.reset({ firstPlayer: PLAYER.WHITE });

    expect(game.firstPlayer).toBe(PLAYER.WHITE);
    expect(game.currentPlayer).toBe(PLAYER.WHITE);
  });

  it('rejects an invalid opening colour on reset', () => {
    const game = new GomokuGame();

    expect(() => game.reset({ firstPlayer: 'green' })).toThrow(RangeError);
  });
});
