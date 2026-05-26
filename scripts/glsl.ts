const GLSL_MARKER = '/* glsl */';

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
			while (index < source.length) {
				if (source.charAt(index) === '\n') {
					output += '\n';
				}
				if (source.charAt(index) === '*' && source.charAt(index + 1) === '/') {
					index += 2;
					break;
				}
				index += 1;
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

	return end;
}

function tokenKind(token: string | undefined): TokenKind {
	if (!token) return 'none';
	if (isIdentifierStart(token.charAt(0))) return 'word';
	if (isDigit(token.charAt(0)) || (token.charAt(0) === '.' && isDigit(token.charAt(1)))) return 'word';
	return 'symbol';
}

function needsSpace(previous: string | undefined, next: string): boolean {
	return tokenKind(previous) === 'word' && tokenKind(next) === 'word';
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

		tokens.push(character);
		index += 1;
	}

	let output = '';
	for (const token of tokens) {
		if (needsSpace(output.at(-1), token)) {
			output += ' ';
		}
		output += token;
	}
	return output;
}

function normalizeDirective(line: string): string {
	return line.trim().replace(/[ \t]+/g, ' ');
}

export function minifyGlsl(source: string): string {
	const stripped = stripComments(source);
	const output: string[] = [];
	let codeLines: string[] = [];

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
		if (!trimmed) continue;

		if (trimmed.startsWith('#')) {
			flushCode();
			output.push(normalizeDirective(trimmed));
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
