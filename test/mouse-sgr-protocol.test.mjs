#!/usr/bin/env node

/**
 * Test suite for SGR Mouse Protocol utilities
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMouseClick,
  generateMouseDrag,
  generateMouseScroll,
  BUTTON_CODES,
  SCROLL_CODES,
  DRAG_MODIFIER
} from '../lib/mouse-sgr-protocol.js';

describe('SGR Mouse Protocol', () => {
  describe('generateMouseClick', () => {
    it('should generate correct click sequences for left button', () => {
      const sequences = generateMouseClick(10, 5, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;11;6M', 'Press sequence should be correct');
      assert.strictEqual(sequences.release, '\x1b[<0;11;6m', 'Release sequence should be correct');
    });

    it('should generate correct click sequences for middle button', () => {
      const sequences = generateMouseClick(10, 5, 'middle');
      assert.strictEqual(sequences.press, '\x1b[<1;11;6M', 'Middle button press should use code 1');
      assert.strictEqual(sequences.release, '\x1b[<1;11;6m', 'Middle button release should use code 1');
    });

    it('should generate correct click sequences for right button', () => {
      const sequences = generateMouseClick(10, 5, 'right');
      assert.strictEqual(sequences.press, '\x1b[<2;11;6M', 'Right button press should use code 2');
      assert.strictEqual(sequences.release, '\x1b[<2;11;6m', 'Right button release should use code 2');
    });

    it('should handle coordinate conversion correctly', () => {
      // 0-based input coordinates should be converted to 1-based
      const sequences = generateMouseClick(0, 0, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;1;1M', 'Origin (0,0) should become (1,1)');
      assert.strictEqual(sequences.release, '\x1b[<0;1;1m', 'Origin release should also be (1,1)');
    });

    it('should handle large coordinates', () => {
      const sequences = generateMouseClick(79, 23, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;80;24M', 'Large coordinates should be converted correctly');
      assert.strictEqual(sequences.release, '\x1b[<0;80;24m', 'Large coordinates release should match');
    });

    it('should default to left button for unknown button', () => {
      const sequences = generateMouseClick(5, 5, 'unknown');
      assert.strictEqual(sequences.press, '\x1b[<0;6;6M', 'Unknown button should default to left (0)');
    });
  });

  describe('generateMouseDrag', () => {
    it('should generate correct drag sequences', () => {
      const sequences = generateMouseDrag(5, 5, 15, 10, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;6;6M', 'Drag should start with press at start position');
      assert.strictEqual(sequences.drag, '\x1b[<32;16;11M', 'Drag motion should use button code + 32');
      assert.strictEqual(sequences.release, '\x1b[<0;16;11m', 'Drag should end with release at end position');
    });

    it('should handle different buttons for drag', () => {
      const sequences = generateMouseDrag(5, 5, 15, 10, 'right');
      assert.strictEqual(sequences.press, '\x1b[<2;6;6M', 'Right button drag press should use code 2');
      assert.strictEqual(sequences.drag, '\x1b[<34;16;11M', 'Right button drag motion should use code 2+32=34');
      assert.strictEqual(sequences.release, '\x1b[<2;16;11m', 'Right button drag release should use code 2');
    });

    it('should handle same position drag (essentially a click)', () => {
      const sequences = generateMouseDrag(10, 10, 10, 10, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;11;11M', 'Same position drag press');
      assert.strictEqual(sequences.drag, '\x1b[<32;11;11M', 'Same position drag motion');
      assert.strictEqual(sequences.release, '\x1b[<0;11;11m', 'Same position drag release');
    });

    it('should handle drag from origin', () => {
      const sequences = generateMouseDrag(0, 0, 10, 10, 'left');
      assert.strictEqual(sequences.press, '\x1b[<0;1;1M', 'Drag from origin should start at (1,1)');
      assert.strictEqual(sequences.drag, '\x1b[<32;11;11M', 'Drag motion to (11,11)');
      assert.strictEqual(sequences.release, '\x1b[<0;11;11m', 'Release at (11,11)');
    });
  });

  describe('generateMouseScroll', () => {
    it('should generate correct scroll up sequence', () => {
      const sequence = generateMouseScroll(10, 10, 'up');
      assert.strictEqual(sequence, '\x1b[<64;11;11M', 'Scroll up should use code 64');
    });

    it('should generate correct scroll down sequence', () => {
      const sequence = generateMouseScroll(10, 10, 'down');
      assert.strictEqual(sequence, '\x1b[<65;11;11M', 'Scroll down should use code 65');
    });

    it('should handle scroll at origin', () => {
      const sequence = generateMouseScroll(0, 0, 'up');
      assert.strictEqual(sequence, '\x1b[<64;1;1M', 'Scroll at origin should be at (1,1)');
    });

    it('should default to down for unknown direction', () => {
      const sequence = generateMouseScroll(5, 5, 'unknown');
      assert.strictEqual(sequence, '\x1b[<65;6;6M', 'Unknown direction should default to down');
    });

    it('should handle large coordinates for scroll', () => {
      const sequence = generateMouseScroll(99, 99, 'up');
      assert.strictEqual(sequence, '\x1b[<64;100;100M', 'Large scroll coordinates should be converted correctly');
    });
  });

  describe('Constants', () => {
    it('should export correct button codes', () => {
      assert.strictEqual(BUTTON_CODES.left, 0, 'Left button code should be 0');
      assert.strictEqual(BUTTON_CODES.middle, 1, 'Middle button code should be 1');
      assert.strictEqual(BUTTON_CODES.right, 2, 'Right button code should be 2');
    });

    it('should export correct scroll codes', () => {
      assert.strictEqual(SCROLL_CODES.up, 64, 'Scroll up code should be 64');
      assert.strictEqual(SCROLL_CODES.down, 65, 'Scroll down code should be 65');
    });

    it('should export correct drag modifier', () => {
      assert.strictEqual(DRAG_MODIFIER, 32, 'Drag modifier should be 32');
    });
  });
});