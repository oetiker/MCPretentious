#!/usr/bin/env node

/**
 * Test suite for SGR Mouse Protocol utilities
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMouseEvent,
  BUTTON_CODES,
  MODIFIERS,
  DRAG_MODIFIER
} from '../lib/mouse-sgr-protocol.js';

describe('SGR Mouse Protocol', () => {
  describe('generateMouseEvent', () => {
    it('should generate correct press sequences for named buttons', () => {
      // Left button press
      const leftPress = generateMouseEvent('press', 10, 5, 'left');
      assert.strictEqual(leftPress, '\x1b[<0;11;6M', 'Left button press should use code 0');
      
      // Middle button press
      const middlePress = generateMouseEvent('press', 10, 5, 'middle');
      assert.strictEqual(middlePress, '\x1b[<1;11;6M', 'Middle button press should use code 1');
      
      // Right button press
      const rightPress = generateMouseEvent('press', 10, 5, 'right');
      assert.strictEqual(rightPress, '\x1b[<2;11;6M', 'Right button press should use code 2');
      
      // Scroll up
      const scrollUp = generateMouseEvent('press', 10, 5, 'scrollUp');
      assert.strictEqual(scrollUp, '\x1b[<64;11;6M', 'Scroll up should use code 64');
      
      // Scroll down
      const scrollDown = generateMouseEvent('press', 10, 5, 'scrollDown');
      assert.strictEqual(scrollDown, '\x1b[<65;11;6M', 'Scroll down should use code 65');
    });

    it('should generate correct release sequences', () => {
      // Left button release (lowercase 'm' suffix)
      const leftRelease = generateMouseEvent('release', 10, 5, 'left');
      assert.strictEqual(leftRelease, '\x1b[<0;11;6m', 'Release should use lowercase m');
      
      // Right button release
      const rightRelease = generateMouseEvent('release', 20, 15, 'right');
      assert.strictEqual(rightRelease, '\x1b[<2;21;16m', 'Right release should use code 2 with lowercase m');
    });

    it('should generate correct drag sequences', () => {
      // Left button drag (adds 32 to button code)
      const leftDrag = generateMouseEvent('drag', 15, 10, 'left');
      assert.strictEqual(leftDrag, '\x1b[<32;16;11M', 'Drag should add 32 to button code');
      
      // Right button drag
      const rightDrag = generateMouseEvent('drag', 15, 10, 'right');
      assert.strictEqual(rightDrag, '\x1b[<34;16;11M', 'Right drag should be 2 + 32 = 34');
    });

    it('should handle numeric button codes', () => {
      // Direct button code
      const button0 = generateMouseEvent('press', 5, 5, 0);
      assert.strictEqual(button0, '\x1b[<0;6;6M', 'Button code 0 should work');
      
      const button2 = generateMouseEvent('press', 5, 5, 2);
      assert.strictEqual(button2, '\x1b[<2;6;6M', 'Button code 2 should work');
      
      const button64 = generateMouseEvent('press', 5, 5, 64);
      assert.strictEqual(button64, '\x1b[<64;6;6M', 'Button code 64 should work');
    });

    it('should handle button-N format', () => {
      const button0 = generateMouseEvent('press', 5, 5, 'button-0');
      assert.strictEqual(button0, '\x1b[<0;6;6M', 'button-0 should work');
      
      const button64 = generateMouseEvent('press', 5, 5, 'button-64');
      assert.strictEqual(button64, '\x1b[<64;6;6M', 'button-64 should work');
      
      const button127 = generateMouseEvent('press', 5, 5, 'button-127');
      assert.strictEqual(button127, '\x1b[<127;6;6M', 'button-127 should work');
    });

    it('should apply modifiers correctly', () => {
      // Shift modifier (adds 4)
      const shiftClick = generateMouseEvent('press', 5, 5, 'left', { shift: true });
      assert.strictEqual(shiftClick, '\x1b[<4;6;6M', 'Shift should add 4 to button code');
      
      // Alt modifier (adds 8)
      const altClick = generateMouseEvent('press', 5, 5, 'left', { alt: true });
      assert.strictEqual(altClick, '\x1b[<8;6;6M', 'Alt should add 8 to button code');
      
      // Ctrl modifier (adds 16)
      const ctrlClick = generateMouseEvent('press', 5, 5, 'left', { ctrl: true });
      assert.strictEqual(ctrlClick, '\x1b[<16;6;6M', 'Ctrl should add 16 to button code');
      
      // Multiple modifiers
      const shiftAltClick = generateMouseEvent('press', 5, 5, 'left', { shift: true, alt: true });
      assert.strictEqual(shiftAltClick, '\x1b[<12;6;6M', 'Shift+Alt should add 4+8=12');
      
      const allModifiers = generateMouseEvent('press', 5, 5, 'left', { shift: true, alt: true, ctrl: true });
      assert.strictEqual(allModifiers, '\x1b[<28;6;6M', 'All modifiers should add 4+8+16=28');
    });

    it('should handle coordinate conversion correctly', () => {
      // 0-based input coordinates should be converted to 1-based
      const origin = generateMouseEvent('press', 0, 0, 'left');
      assert.strictEqual(origin, '\x1b[<0;1;1M', 'Origin (0,0) should become (1,1)');
      
      // Large coordinates
      const large = generateMouseEvent('press', 79, 23, 'left');
      assert.strictEqual(large, '\x1b[<0;80;24M', 'Coordinates should be incremented by 1');
    });

    it('should combine drag with modifiers correctly', () => {
      // Drag with shift
      const shiftDrag = generateMouseEvent('drag', 10, 10, 'left', { shift: true });
      assert.strictEqual(shiftDrag, '\x1b[<36;11;11M', 'Shift drag should be 0+4+32=36');
      
      // Drag with middle button and ctrl
      const ctrlMiddleDrag = generateMouseEvent('drag', 10, 10, 'middle', { ctrl: true });
      assert.strictEqual(ctrlMiddleDrag, '\x1b[<49;11;11M', 'Ctrl middle drag should be 1+16+32=49');
    });

    it('should throw errors for invalid inputs', () => {
      assert.throws(
        () => generateMouseEvent('press', 5, 5, 'invalid'),
        /Invalid button/,
        'Invalid button name should throw'
      );
      
      assert.throws(
        () => generateMouseEvent('press', 5, 5, 'button-128'),
        /Invalid button code/,
        'Button code > 127 should throw'
      );
      
      assert.throws(
        () => generateMouseEvent('press', 5, 5, 'button-abc'),
        /Invalid button code/,
        'Non-numeric button code should throw'
      );
    });
  });

  describe('Constants', () => {
    it('should export correct button codes', () => {
      assert.strictEqual(BUTTON_CODES.left, 0, 'Left button should be 0');
      assert.strictEqual(BUTTON_CODES.middle, 1, 'Middle button should be 1');
      assert.strictEqual(BUTTON_CODES.right, 2, 'Right button should be 2');
      assert.strictEqual(BUTTON_CODES.scrollUp, 64, 'Scroll up should be 64');
      assert.strictEqual(BUTTON_CODES.scrollDown, 65, 'Scroll down should be 65');
    });

    it('should export correct modifier codes', () => {
      assert.strictEqual(MODIFIERS.shift, 4, 'Shift modifier should be 4');
      assert.strictEqual(MODIFIERS.alt, 8, 'Alt modifier should be 8');
      assert.strictEqual(MODIFIERS.ctrl, 16, 'Ctrl modifier should be 16');
    });

    it('should export correct drag modifier', () => {
      assert.strictEqual(DRAG_MODIFIER, 32, 'Drag modifier should be 32');
    });
  });
});