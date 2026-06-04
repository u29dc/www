const GLSL_MARKER = '/* glsl */';
const MULTI_CHARACTER_OPERATORS = new Set(['++', '--', '<=', '>=', '==', '!=', '&&', '||', '^^', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);

type TokenKind = 'none' | 'symbol' | 'word';

interface TransformResult {
	code: string;
	map: null;
}

interface ViteTransformPlugin {
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): TransformResult | null;
}

function isWhitespace(character: string): boolean {
	return character === ' ' || character === '\n' || character === '\r' || character === '\t';
}

function isIdentifierStart(character: string): boolean {
	return /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string): boolean {
	return /[A-Za-z0-9_]/.test(character);
}

function isDigit(character: string): boolean {
	return /[0-9]/.test(character);
}

function isHexDigit(character: string): boolean {
	return /[0-9A-Fa-f]/.test(character);
}

function isTokenLikeCharacter(character: string): boolean {
	return isIdentifierPart(character) || character === '.';
}

function wouldMergeTokens(previous: string, next: string): boolean {
	return MULTI_CHARACTER_OPERATORS.has(`${previous}${next}`) || previous + next === '//' || previous + next === '/*';
}

function needsRemovedCommentSpace(previous: string, next: string): boolean {
	return (isTokenLikeCharacter(previous) && isTokenLikeCharacter(next)) || wouldMergeTokens(previous, next);
}

function stripComments(source: string): string {
	let output = '';
	let index = 0;

	while (index < source.length) {
		const character = source.charAt(index);
		const next = source.charAt(index + 1);

		if (character === '/' && next === '/') {
			index += 2;
			while (index < source.length && source.charAt(index) !== '\n') {
				index += 1;
			}
			if (source.charAt(index) === '\n') {
				output += '\n';
				index += 1;
			}
			continue;
		}

		if (character === '/' && next === '*') {
			index += 2;
			let hasNewline = false;
			while (index < source.length) {
				if (source.charAt(index) === '\n') {
					output += '\n';
					hasNewline = true;
				}
				if (source.charAt(index) === '*' && source.charAt(index + 1) === '/') {
					index += 2;
					break;
				}
				index += 1;
			}
			const previous = output.at(-1);
			const nextSource = source.charAt(index);
			if (!hasNewline && previous && nextSource && !isWhitespace(previous) && !isWhitespace(nextSource) && needsRemovedCommentSpace(previous, nextSource)) {
				output += ' ';
			}
			continue;
		}

		output += character;
		index += 1;
	}

	return output;
}

function readIdentifier(source: string, start: number): number {
	let end = start + 1;
	while (end < source.length && isIdentifierPart(source.charAt(end))) {
		end += 1;
	}
	return end;
}

function readNumber(source: string, start: number): number {
	let end = start;

	if (source.charAt(start) === '0' && (source.charAt(start + 1) === 'x' || source.charAt(start + 1) === 'X')) {
		end = start + 2;
		while (end < source.length && isHexDigit(source.charAt(end))) {
			end += 1;
		}
		if (source.charAt(end) === 'u' || source.charAt(end) === 'U') {
			end += 1;
		}
		return end;
	}

	while (end < source.length && isDigit(source.charAt(end))) {
		end += 1;
	}

	if (source.charAt(end) === '.') {
		end += 1;
		while (end < source.length && isDigit(source.charAt(end))) {
			end += 1;
		}
	}

	if (source.charAt(end) === 'e' || source.charAt(end) === 'E') {
		const exponentStart = end;
		end += 1;
		if (source.charAt(end) === '+' || source.charAt(end) === '-') {
			end += 1;
		}
		const digitStart = end;
		while (end < source.length && isDigit(source.charAt(end))) {
			end += 1;
		}
		if (digitStart === end) {
			end = exponentStart;
		}
	}

	if (source.charAt(end) === 'u' || source.charAt(end) === 'U' || source.charAt(end) === 'f' || source.charAt(end) === 'F') {
		end += 1;
	}

	return end;
}

function tokenKind(token: string | undefined): TokenKind {
	if (!token) return 'none';
	if (isIdentifierStart(token.charAt(0))) return 'word';
	if (isDigit(token.charAt(0)) || (token.charAt(0) === '.' && isDigit(token.charAt(1)))) return 'word';
	return 'symbol';
}

function needsSpace(previous: string | undefined, next: string): boolean {
	if (tokenKind(previous) === 'word' && tokenKind(next) === 'word') return true;
	return previous !== undefined && previous.length === 1 && next.length === 1 && wouldMergeTokens(previous, next);
}

function readSymbol(source: string, start: number): number {
	for (const length of [3, 2]) {
		const candidate = source.slice(start, start + length);
		if (MULTI_CHARACTER_OPERATORS.has(candidate)) return start + length;
	}
	return start + 1;
}

function minifyCodeLine(source: string): string {
	const tokens: string[] = [];
	let index = 0;

	while (index < source.length) {
		const character = source.charAt(index);

		if (isWhitespace(character)) {
			index += 1;
			continue;
		}

		if (isIdentifierStart(character)) {
			const end = readIdentifier(source, index);
			tokens.push(source.slice(index, end));
			index = end;
			continue;
		}

		if (isDigit(character) || (character === '.' && isDigit(source.charAt(index + 1)))) {
			const end = readNumber(source, index);
			tokens.push(source.slice(index, end));
			index = end;
			continue;
		}

		const end = readSymbol(source, index);
		tokens.push(source.slice(index, end));
		index = end;
	}

	let output = '';
	let previousToken: string | undefined;
	for (const token of tokens) {
		if (needsSpace(previousToken, token)) {
			output += ' ';
		}
		output += token;
		previousToken = token;
	}
	return output;
}

function normalizeDirective(line: string): string {
	return line.trim().replace(/[ \t]+/g, ' ');
}

function hasDirectiveContinuation(line: string): boolean {
	const trimmed = line.trimEnd();
	let backslashes = 0;
	for (let index = trimmed.length - 1; index >= 0 && trimmed.charAt(index) === '\\'; index -= 1) {
		backslashes += 1;
	}
	return backslashes % 2 === 1;
}

export function minifyGlsl(source: string): string {
	const stripped = stripComments(source);
	const output: string[] = [];
	let codeLines: string[] = [];
	let isDirectiveContinuation = false;

	const flushCode = () => {
		if (codeLines.length === 0) return;
		const minified = minifyCodeLine(codeLines.join(' '));
		if (minified) {
			output.push(minified);
		}
		codeLines = [];
	};

	for (const line of stripped.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (isDirectiveContinuation) {
				output.push('');
				isDirectiveContinuation = false;
			}
			continue;
		}

		if (trimmed.startsWith('#') || isDirectiveContinuation) {
			flushCode();
			output.push(normalizeDirective(trimmed));
			isDirectiveContinuation = hasDirectiveContinuation(line);
			continue;
		}

		codeLines.push(trimmed);
	}

	flushCode();
	return output.join('\n');
}

function findTemplateEnd(code: string, start: number): number {
	let index = start + 1;
	while (index < code.length) {
		const character = code.charAt(index);
		if (character === '\\') {
			index += 2;
			continue;
		}
		if (character === '$' && code.charAt(index + 1) === '{') {
			throw new Error('GLSL template literals must not contain interpolation.');
		}
		if (character === '`') {
			return index;
		}
		index += 1;
	}
	throw new Error('Unterminated GLSL template literal.');
}

function transformGlslTemplates(code: string): TransformResult | null {
	let output = '';
	let cursor = 0;
	let markerIndex = code.indexOf(GLSL_MARKER);

	while (markerIndex !== -1) {
		output += code.slice(cursor, markerIndex);

		let templateStart = markerIndex + GLSL_MARKER.length;
		while (templateStart < code.length && isWhitespace(code.charAt(templateStart))) {
			templateStart += 1;
		}

		if (code.charAt(templateStart) !== '`') {
			output += GLSL_MARKER;
			cursor = markerIndex + GLSL_MARKER.length;
			markerIndex = code.indexOf(GLSL_MARKER, cursor);
			continue;
		}

		const templateEnd = findTemplateEnd(code, templateStart);
		const source = code.slice(templateStart + 1, templateEnd);
		const minified = minifyGlsl(source);
		output += JSON.stringify(minified);
		cursor = templateEnd + 1;
		markerIndex = code.indexOf(GLSL_MARKER, cursor);
	}

	if (cursor === 0) return null;
	output += code.slice(cursor);

	return {
		code: output,
		map: null,
	};
}

export function glslStringMinify(): ViteTransformPlugin {
	return {
		name: 'glsl-string-minify',
		enforce: 'pre',
		transform(code, id) {
			if (!id.includes('/src/') || !/\.[cm]?[jt]sx?$/.test(id) || !code.includes(GLSL_MARKER)) {
				return null;
			}
			return transformGlslTemplates(code);
		},
	};
}
