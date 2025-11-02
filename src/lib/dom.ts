/**
 * DOM Text Utilities
 *
 * ## SUMMARY
 * Utilities for extracting and manipulating text content from React nodes and DOM elements.
 *
 * ## RESPONSIBILITIES
 * - Extract plain text from React node trees
 * - Parse text into word and whitespace segments
 * - Identify whitespace-only strings
 * - Locate last non-whitespace word in parsed arrays
 *
 * @module lib/dom
 */

import type { ReactNode } from 'react';

/**
 * Recursively extracts plain text content from React node tree.
 *
 * Handles various React node types including strings, numbers, arrays,
 * and React elements with children. Useful for getting the text representation
 * of complex component structures.
 *
 * @param node - React node to extract text from
 * @returns Concatenated text content as single string
 *
 * @example
 * extractTextContent('Hello') // 'Hello'
 * extractTextContent(42) // '42'
 * extractTextContent(<div>Hello <span>World</span></div>) // 'Hello World'
 * extractTextContent(['Hello', ' ', 'World']) // 'Hello World'
 */
export function extractTextContent(node: ReactNode): string {
	if (node === null || node === undefined) {
		return '';
	}

	if (typeof node === 'string') {
		return node;
	}

	if (typeof node === 'number') {
		return String(node);
	}

	if (Array.isArray(node)) {
		return node.map((child) => extractTextContent(child)).join('');
	}

	if (typeof node === 'object' && 'props' in node) {
		const element = node as { props?: { children?: ReactNode } };
		if (element.props?.children !== undefined) {
			return extractTextContent(element.props.children);
		}
	}

	return '';
}

/**
 * Splits text on whitespace boundaries while preserving spaces as array elements.
 *
 * Creates an array alternating between words and whitespace segments. Useful
 * for word-by-word animations or manipulations where spacing must be preserved.
 *
 * @param text - Text string to split
 * @returns Array of words and whitespace segments
 *
 * @example
 * splitTextIntoWords('hello world') // ['hello', ' ', 'world']
 * splitTextIntoWords('a  b') // ['a', '  ', 'b']
 * splitTextIntoWords('  hello  ') // ['', '  ', 'hello', '  ', '']
 */
export function splitTextIntoWords(text: string): string[] {
	return text.split(/(\s+)/);
}

/**
 * Checks if string contains only whitespace characters.
 *
 * Returns true for strings containing spaces, tabs, newlines, or other
 * whitespace characters. Returns false for empty strings or strings
 * with any non-whitespace content.
 *
 * @param str - String to test
 * @returns True if string is only whitespace
 *
 * @example
 * isWhitespace('  ') // true
 * isWhitespace('\t\n') // true
 * isWhitespace('a') // false
 * isWhitespace('') // false
 * isWhitespace(' a ') // false
 */
export function isWhitespace(str: string): boolean {
	return /^\s+$/.test(str);
}

/**
 * Finds index of last non-whitespace word in array.
 *
 * Scans backward from the end of the array to locate the last element
 * that is not purely whitespace. Useful for trimming operations or
 * identifying the final meaningful word.
 *
 * @param words - Array of word and whitespace segments
 * @returns Index of last non-whitespace word, or -1 if none found
 *
 * @example
 * findLastWordIndex(['hello', ' ', 'world']) // 2
 * findLastWordIndex(['hello', ' ', 'world', ' ']) // 2
 * findLastWordIndex(['  ', '  ']) // -1
 * findLastWordIndex([]) // -1
 * findLastWordIndex(['word']) // 0
 */
export function findLastWordIndex(words: string[]): number {
	for (let i = words.length - 1; i >= 0; i--) {
		const word = words[i];
		if (word !== undefined && !isWhitespace(word) && word !== '') {
			return i;
		}
	}
	return -1;
}
