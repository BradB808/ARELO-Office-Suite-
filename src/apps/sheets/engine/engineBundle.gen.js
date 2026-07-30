// GENERATED FILE — do not hand-edit.
// Source: src/apps/sheets/engine/standalone.ts (+ the rest of engine/**).
// Regenerate with: node scripts/build-engine-bundle.mjs
//
// A self-contained IIFE bundle of the Sheets formula engine, embedded into
// the "Living spreadsheet" export (see src/apps/sheets/livingExport.ts) so
// exported .html files can recalculate formulas fully offline, with no
// dependency on the rest of the app. Sets globalThis.AnleoEngine.computeSheet.
(function() {
	//#region src/apps/sheets/engine/refs.ts
	function colToLetters(col) {
		let n = col + 1;
		let s = "";
		while (n > 0) {
			const rem = (n - 1) % 26;
			s = String.fromCharCode(65 + rem) + s;
			n = Math.floor((n - 1) / 26);
		}
		return s;
	}
	function lettersToCol(letters) {
		let n = 0;
		const up = letters.toUpperCase();
		for (let i = 0; i < up.length; i++) n = n * 26 + (up.charCodeAt(i) - 64);
		return n - 1;
	}
	var REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
	function parseCellRef(s) {
		const m = REF_RE.exec(s.trim());
		if (!m) return null;
		const [, ca, letters, ra, digits] = m;
		const row = parseInt(digits, 10) - 1;
		if (row < 0) return null;
		return {
			col: lettersToCol(letters),
			row,
			colAbs: ca === "$",
			rowAbs: ra === "$"
		};
	}
	function refToString(col, row, colAbs = false, rowAbs = false) {
		const c = Math.max(0, col);
		const r = Math.max(0, row);
		return `${colAbs ? "$" : ""}${colToLetters(c)}${rowAbs ? "$" : ""}${r + 1}`;
	}
	function rangeBounds(a, b) {
		return {
			col1: Math.min(a.col, b.col),
			col2: Math.max(a.col, b.col),
			row1: Math.min(a.row, b.row),
			row2: Math.max(a.row, b.row)
		};
	}
	//#endregion
	//#region \0@oxc-project+runtime@0.139.0/helpers/esm/typeof.js
	function _typeof(o) {
		"@babel/helpers - typeof";
		return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
			return typeof o;
		} : function(o) {
			return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
		}, _typeof(o);
	}
	//#endregion
	//#region \0@oxc-project+runtime@0.139.0/helpers/esm/toPrimitive.js
	function toPrimitive(t, r) {
		if ("object" != _typeof(t) || !t) return t;
		var e = t[Symbol.toPrimitive];
		if (void 0 !== e) {
			var i = e.call(t, r || "default");
			if ("object" != _typeof(i)) return i;
			throw new TypeError("@@toPrimitive must return a primitive value.");
		}
		return ("string" === r ? String : Number)(t);
	}
	//#endregion
	//#region \0@oxc-project+runtime@0.139.0/helpers/esm/toPropertyKey.js
	function toPropertyKey(t) {
		var i = toPrimitive(t, "string");
		return "symbol" == _typeof(i) ? i : i + "";
	}
	//#endregion
	//#region \0@oxc-project+runtime@0.139.0/helpers/esm/defineProperty.js
	function _defineProperty(e, r, t) {
		return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
			value: t,
			enumerable: !0,
			configurable: !0,
			writable: !0
		}) : e[r] = t, e;
	}
	//#endregion
	//#region src/apps/sheets/engine/values.ts
	var FErr = class {
		constructor(code) {
			_defineProperty(this, "code", void 0);
			this.code = code;
		}
	};
	function isErr(v) {
		return v instanceof FErr;
	}
	function toNumber(v) {
		if (v instanceof FErr) return v;
		if (typeof v === "number") return v;
		if (typeof v === "boolean") return v ? 1 : 0;
		const s = v.trim();
		if (s === "") return 0;
		if (/^-?\d+(\.\d+)?%$/.test(s)) return parseFloat(s) / 100;
		const cleaned = s.replace(/^\$/, "").replace(/,/g, "");
		const n = Number(cleaned);
		if (Number.isNaN(n)) return new FErr("#VALUE!");
		return n;
	}
	/** Like toNumber but collapses errors to NaN instead of propagating — for filters/matchers. */
	function toNumberLoose(v) {
		const n = toNumber(v);
		return n instanceof FErr ? NaN : n;
	}
	function toBoolean(v) {
		if (v instanceof FErr) return v;
		if (typeof v === "boolean") return v;
		if (typeof v === "number") return v !== 0;
		const s = v.trim().toUpperCase();
		if (s === "TRUE") return true;
		if (s === "FALSE") return false;
		if (s === "") return false;
		return new FErr("#VALUE!");
	}
	function formatPlainNumber(n) {
		if (!Number.isFinite(n)) return n > 0 ? "Infinity" : n < 0 ? "-Infinity" : "NaN";
		if (Number.isInteger(n)) return String(n);
		const r = Math.round(n * 1e10) / 1e10;
		return String(r);
	}
	function toDisplayString(v) {
		if (v instanceof FErr) return v.code;
		if (typeof v === "number") return formatPlainNumber(v);
		if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
		return v;
	}
	function typeRank(v) {
		if (typeof v === "number") return 0;
		if (typeof v === "string") return 1;
		if (typeof v === "boolean") return 2;
		return 3;
	}
	/** -1 / 0 / 1, Excel-style: numbers < text < booleans when types differ. */
	function compareValues(a, b) {
		if (typeof a === typeof b) {
			if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
			if (typeof a === "string" && typeof b === "string") {
				const la = a.toLowerCase();
				const lb = b.toLowerCase();
				return la === lb ? 0 : la < lb ? -1 : 1;
			}
			if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
		}
		const ra = typeRank(a);
		const rb = typeRank(b);
		return ra === rb ? 0 : ra < rb ? -1 : 1;
	}
	function valuesEqual(a, b) {
		return compareValues(a, b) === 0;
	}
	function wildcardToRegExp(pattern) {
		let re = "";
		for (const ch of pattern) if (ch === "*") re += ".*";
		else if (ch === "?") re += ".";
		else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp("^" + re + "$", "i");
	}
	/** Builds a predicate from a COUNTIF/SUMIF/AVERAGEIF-style criteria value. */
	function buildCriteriaMatcher(critRaw) {
		if (critRaw instanceof FErr) return () => false;
		if (typeof critRaw === "number") return (v) => {
			const n = toNumber(v);
			return !(n instanceof FErr) && n === critRaw;
		};
		if (typeof critRaw === "boolean") return (v) => {
			const b = toBoolean(v);
			return !(b instanceof FErr) && b === critRaw;
		};
		const s = critRaw;
		const m = /^(<=|>=|<>|<|>|=)([\s\S]*)$/.exec(s);
		const op = m ? m[1] : "=";
		const rest = m ? m[2] : s;
		const numRest = rest.trim() !== "" ? Number(rest) : NaN;
		const isNumeric = rest.trim() !== "" && !Number.isNaN(numRest);
		if (op === "<" || op === ">" || op === "<=" || op === ">=") return (v) => {
			const n = toNumberLoose(v);
			if (Number.isNaN(n) || !isNumeric) return false;
			switch (op) {
				case "<": return n < numRest;
				case ">": return n > numRest;
				case "<=": return n <= numRest;
				default: return n >= numRest;
			}
		};
		if (isNumeric) return (v) => {
			const n = toNumberLoose(v);
			const eq = !Number.isNaN(n) && n === numRest;
			return op === "<>" ? !eq : eq;
		};
		if (rest.trim() === "") return (v) => {
			const eq = v === "";
			return op === "<>" ? !eq : eq;
		};
		const re = wildcardToRegExp(rest);
		return (v) => {
			const vs = toDisplayString(v);
			const eq = re.test(vs);
			return op === "<>" ? !eq : eq;
		};
	}
	//#endregion
	//#region src/apps/sheets/engine/dates.ts
	var EPOCH_MS = Date.UTC(1899, 11, 30);
	var MS_PER_DAY = 864e5;
	function dateToSerial(y, m, d, h = 0, mi = 0, s = 0) {
		return (Date.UTC(y, m - 1, d, h, mi, s) - EPOCH_MS) / MS_PER_DAY;
	}
	function jsDateToSerial(dt) {
		return (dt.getTime() - EPOCH_MS) / MS_PER_DAY;
	}
	function serialToDate(serial) {
		return new Date(EPOCH_MS + Math.round(serial * MS_PER_DAY));
	}
	function serialParts(serial) {
		const dt = serialToDate(serial);
		return {
			year: dt.getUTCFullYear(),
			month: dt.getUTCMonth() + 1,
			day: dt.getUTCDate(),
			hour: dt.getUTCHours(),
			minute: dt.getUTCMinutes(),
			second: dt.getUTCSeconds(),
			weekday: dt.getUTCDay()
		};
	}
	//#endregion
	//#region src/apps/sheets/engine/functions.ts
	function num(v) {
		const n = toNumber(v);
		if (isErr(n)) throw n;
		return n;
	}
	function bool(v) {
		const b = toBoolean(v);
		if (isErr(b)) throw b;
		return b;
	}
	function str(v) {
		if (isErr(v)) throw v;
		return toDisplayString(v);
	}
	function arg(args, i, ctx) {
		const n = args[i];
		if (!n) return "";
		const v = ctx.evalNode(n);
		if (isErr(v)) throw v;
		return v;
	}
	function argNum(args, i, ctx, dflt) {
		if (args[i] === void 0) {
			if (dflt === void 0) throw new FErr("#VALUE!");
			return dflt;
		}
		return num(arg(args, i, ctx));
	}
	function argStr(args, i, ctx, dflt = "") {
		if (args[i] === void 0) return dflt;
		return str(arg(args, i, ctx));
	}
	/** Flattens numeric values out of variadic range/scalar args (skips text & blanks). */
	function flattenNumbers(args, ctx) {
		const out = [];
		for (const a of args) for (const v of ctx.rangeValues(a)) {
			if (isErr(v)) throw v;
			if (typeof v === "number") out.push(v);
			else if (typeof v === "string" && v.trim() !== "") {
				const n = Number(v);
				if (!Number.isNaN(n)) out.push(n);
			}
		}
		return out;
	}
	function flattenAll(args, ctx) {
		const out = [];
		for (const a of args) for (const v of ctx.rangeValues(a)) out.push(v);
		return out;
	}
	function round(n, digits) {
		const f = Math.pow(10, digits);
		return Math.sign(n) * Math.round(Math.abs(n) * f) / f;
	}
	function roundUp(n, digits) {
		const f = Math.pow(10, digits);
		return Math.sign(n) * Math.ceil(Math.abs(n) * f) / f;
	}
	function roundDown(n, digits) {
		const f = Math.pow(10, digits);
		return Math.sign(n) * Math.floor(Math.abs(n) * f) / f;
	}
	function compareLookup(a, b) {
		return compareValues(a, b);
	}
	function gcd2(a, b) {
		a = Math.abs(Math.trunc(a));
		b = Math.abs(Math.trunc(b));
		while (b) [a, b] = [b, a % b];
		return a;
	}
	function factorial(n) {
		let r = 1;
		for (let i = 2; i <= n; i++) r *= i;
		return r;
	}
	/** Excel PERCENTILE.INC-style linear interpolation, k in [0,1]. */
	function percentileOf(ns, k) {
		if (ns.length === 0) return new FErr("#NUM!");
		if (k < 0 || k > 1) return new FErr("#NUM!");
		const sorted = ns.slice().sort((x, y) => x - y);
		const idx = k * (sorted.length - 1);
		const lo = Math.floor(idx);
		const hi = Math.ceil(idx);
		if (lo === hi) return sorted[lo];
		const frac = idx - lo;
		return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
	}
	/** Two ranges walked in lockstep; rows where either side isn't numeric are dropped. */
	function pairedNumbers(n1, n2, c) {
		const v1 = c.rangeValues(n1);
		const v2 = c.rangeValues(n2);
		const xs = [];
		const ys = [];
		const len = Math.min(v1.length, v2.length);
		for (let i = 0; i < len; i++) {
			const x = toNumber(v1[i]);
			const y = toNumber(v2[i]);
			if (isErr(x) || isErr(y)) continue;
			xs.push(x);
			ys.push(y);
		}
		return [xs, ys];
	}
	/** Linear regression (least squares) over (xs, ys) — returns {slope, intercept} or an error. */
	function linreg(ys, xs) {
		if (xs.length < 2) return new FErr("#DIV/0!");
		const mx = xs.reduce((s, n) => s + n, 0) / xs.length;
		const my = ys.reduce((s, n) => s + n, 0) / ys.length;
		let num = 0;
		let den = 0;
		for (let i = 0; i < xs.length; i++) {
			num += (xs[i] - mx) * (ys[i] - my);
			den += (xs[i] - mx) ** 2;
		}
		if (den === 0) return new FErr("#DIV/0!");
		const slope = num / den;
		return {
			slope,
			intercept: my - slope * mx
		};
	}
	/** Builds per-row match booleans for SUMIFS/COUNTIFS/AVERAGEIFS/MAXIFS/MINIFS-style range/criteria pairs. */
	function matchAllCriteria(a, c, startIdx, len) {
		const matchers = [];
		const ranges = [];
		for (let i = startIdx; i + 1 < a.length; i += 2) {
			ranges.push(c.rangeValues(a[i]));
			matchers.push(buildCriteriaMatcher(arg(a, i + 1, c)));
		}
		const out = [];
		for (let row = 0; row < len; row++) {
			let all = true;
			for (let k = 0; k < matchers.length; k++) if (!matchers[k](ranges[k][row])) {
				all = false;
				break;
			}
			out.push(all);
		}
		return out;
	}
	function isWeekend(dt) {
		const wd = dt.getUTCDay();
		return wd === 0 || wd === 6;
	}
	/** Adds calendar months to a serial date, clamping the day to the target month's length. */
	function addMonths(serial, months) {
		const dt = serialToDate(serial);
		const y = dt.getUTCFullYear();
		const m = dt.getUTCMonth();
		const d = dt.getUTCDate();
		const total = m + months;
		const newY = y + Math.floor(total / 12);
		const newM = (total % 12 + 12) % 12;
		const lastDay = new Date(Date.UTC(newY, newM + 1, 0)).getUTCDate();
		return dateToSerial(newY, newM + 1, Math.min(d, lastDay));
	}
	var FUNCTIONS = {
		SUM: (a, c) => flattenNumbers(a, c).reduce((s, n) => s + n, 0),
		AVERAGE: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (ns.length === 0) return new FErr("#DIV/0!");
			return ns.reduce((s, n) => s + n, 0) / ns.length;
		},
		MIN: (a, c) => {
			const ns = flattenNumbers(a, c);
			return ns.length ? Math.min(...ns) : 0;
		},
		MAX: (a, c) => {
			const ns = flattenNumbers(a, c);
			return ns.length ? Math.max(...ns) : 0;
		},
		COUNT: (a, c) => {
			let n = 0;
			for (const arg of a) for (const v of c.rangeValues(arg)) {
				if (isErr(v)) continue;
				if (typeof v === "number") n++;
				else if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) n++;
			}
			return n;
		},
		COUNTA: (a, c) => {
			let n = 0;
			for (const arg of a) for (const v of c.rangeValues(arg)) if (v !== "") n++;
			return n;
		},
		COUNTBLANK: (a, c) => {
			let n = 0;
			for (const arg of a) for (const v of c.rangeValues(arg)) if (v === "") n++;
			return n;
		},
		COUNTIF: (a, c) => {
			const matcher = buildCriteriaMatcher(arg(a, 1, c));
			return c.rangeValues(a[0]).filter(matcher).length;
		},
		SUMIF: (a, c) => {
			const matcher = buildCriteriaMatcher(arg(a, 1, c));
			const critVals = c.rangeValues(a[0]);
			const sumVals = a[2] ? c.rangeValues(a[2]) : critVals;
			let total = 0;
			for (let i = 0; i < critVals.length; i++) if (matcher(critVals[i])) {
				const sv = sumVals[i];
				if (sv !== void 0) {
					const n = toNumber(sv);
					if (!isErr(n)) total += n;
				}
			}
			return total;
		},
		AVERAGEIF: (a, c) => {
			const matcher = buildCriteriaMatcher(arg(a, 1, c));
			const critVals = c.rangeValues(a[0]);
			const avgVals = a[2] ? c.rangeValues(a[2]) : critVals;
			let total = 0;
			let count = 0;
			for (let i = 0; i < critVals.length; i++) if (matcher(critVals[i])) {
				const sv = avgVals[i];
				if (sv !== void 0) {
					const n = toNumber(sv);
					if (!isErr(n)) {
						total += n;
						count++;
					}
				}
			}
			if (count === 0) return new FErr("#DIV/0!");
			return total / count;
		},
		PRODUCT: (a, c) => {
			const ns = flattenNumbers(a, c);
			return ns.length ? ns.reduce((s, n) => s * n, 1) : 0;
		},
		MEDIAN: (a, c) => {
			const ns = flattenNumbers(a, c).slice().sort((x, y) => x - y);
			if (!ns.length) return new FErr("#DIV/0!");
			const mid = Math.floor(ns.length / 2);
			return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
		},
		MODE: (a, c) => {
			var _freq$get;
			const ns = flattenNumbers(a, c);
			const freq = /* @__PURE__ */ new Map();
			for (const n of ns) freq.set(n, ((_freq$get = freq.get(n)) !== null && _freq$get !== void 0 ? _freq$get : 0) + 1);
			let best = null;
			let bestCount = 1;
			for (const n of ns) {
				const f = freq.get(n);
				if (f > bestCount) {
					bestCount = f;
					best = n;
				}
			}
			return best === null ? new FErr("#VALUE!") : best;
		},
		STDEV: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (ns.length < 2) return new FErr("#DIV/0!");
			const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
			const variance = ns.reduce((s, n) => s + (n - mean) ** 2, 0) / (ns.length - 1);
			return Math.sqrt(variance);
		},
		VAR: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (ns.length < 2) return new FErr("#DIV/0!");
			const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
			return ns.reduce((s, n) => s + (n - mean) ** 2, 0) / (ns.length - 1);
		},
		LARGE: (a, c) => {
			const ns = flattenNumbers([a[0]], c).slice().sort((x, y) => y - x);
			const k = Math.round(argNum(a, 1, c));
			if (k < 1 || k > ns.length) return new FErr("#VALUE!");
			return ns[k - 1];
		},
		SMALL: (a, c) => {
			const ns = flattenNumbers([a[0]], c).slice().sort((x, y) => x - y);
			const k = Math.round(argNum(a, 1, c));
			if (k < 1 || k > ns.length) return new FErr("#VALUE!");
			return ns[k - 1];
		},
		ROUND: (a, c) => round(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
		ROUNDUP: (a, c) => roundUp(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
		ROUNDDOWN: (a, c) => roundDown(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0))),
		INT: (a, c) => Math.floor(argNum(a, 0, c)),
		ABS: (a, c) => Math.abs(argNum(a, 0, c)),
		SQRT: (a, c) => {
			const n = argNum(a, 0, c);
			if (n < 0) return new FErr("#VALUE!");
			return Math.sqrt(n);
		},
		POWER: (a, c) => Math.pow(argNum(a, 0, c), argNum(a, 1, c)),
		MOD: (a, c) => {
			const n = argNum(a, 0, c);
			const d = argNum(a, 1, c);
			if (d === 0) return new FErr("#DIV/0!");
			return n - d * Math.floor(n / d);
		},
		FLOOR: (a, c) => {
			const n = argNum(a, 0, c);
			const sig = argNum(a, 1, c, 1);
			if (sig === 0) return new FErr("#DIV/0!");
			return Math.floor(n / sig) * sig;
		},
		CEILING: (a, c) => {
			const n = argNum(a, 0, c);
			const sig = argNum(a, 1, c, 1);
			if (sig === 0) return new FErr("#DIV/0!");
			return Math.ceil(n / sig) * sig;
		},
		EXP: (a, c) => Math.exp(argNum(a, 0, c)),
		LN: (a, c) => {
			const n = argNum(a, 0, c);
			if (n <= 0) return new FErr("#VALUE!");
			return Math.log(n);
		},
		LOG: (a, c) => {
			const n = argNum(a, 0, c);
			const base = argNum(a, 1, c, 10);
			if (n <= 0 || base <= 0 || base === 1) return new FErr("#VALUE!");
			return Math.log(n) / Math.log(base);
		},
		LOG10: (a, c) => {
			const n = argNum(a, 0, c);
			if (n <= 0) return new FErr("#VALUE!");
			return Math.log10(n);
		},
		PI: () => Math.PI,
		RAND: () => Math.random(),
		RANDBETWEEN: (a, c) => {
			const lo = Math.round(argNum(a, 0, c));
			const hi = Math.round(argNum(a, 1, c));
			return Math.floor(Math.random() * (hi - lo + 1)) + lo;
		},
		SIGN: (a, c) => Math.sign(argNum(a, 0, c)),
		TRUNC: (a, c) => {
			return roundDown(argNum(a, 0, c), Math.round(argNum(a, 1, c, 0)));
		},
		IF: (a, c) => {
			if (bool(arg(a, 0, c))) return a[1] !== void 0 ? arg(a, 1, c) : true;
			return a[2] !== void 0 ? arg(a, 2, c) : false;
		},
		IFS: (a, c) => {
			for (let i = 0; i + 1 < a.length; i += 2) if (bool(arg(a, i, c))) return arg(a, i + 1, c);
			return new FErr("#VALUE!");
		},
		AND: (a, c) => {
			for (const n of a) for (const v of c.rangeValues(n)) {
				if (v === "") continue;
				if (!bool(v)) return false;
			}
			return true;
		},
		OR: (a, c) => {
			for (const n of a) for (const v of c.rangeValues(n)) {
				if (v === "") continue;
				if (bool(v)) return true;
			}
			return false;
		},
		NOT: (a, c) => !bool(arg(a, 0, c)),
		XOR: (a, c) => {
			let count = 0;
			for (const n of a) for (const v of c.rangeValues(n)) {
				if (v === "") continue;
				if (bool(v)) count++;
			}
			return count % 2 === 1;
		},
		IFERROR: (a, c) => {
			const v = c.evalNode(a[0]);
			if (isErr(v)) return c.evalNode(a[1]);
			return v;
		},
		ISBLANK: (a, c) => c.evalNode(a[0]) === "",
		ISNUMBER: (a, c) => typeof c.evalNode(a[0]) === "number",
		ISTEXT: (a, c) => {
			const v = c.evalNode(a[0]);
			return typeof v === "string" && v !== "";
		},
		CONCAT: (a, c) => flattenAll(a, c).map((v) => str(v)).join(""),
		CONCATENATE: (a, c) => flattenAll(a, c).map((v) => str(v)).join(""),
		TEXTJOIN: (a, c) => {
			const delim = argStr(a, 0, c);
			const ignoreEmpty = bool(arg(a, 1, c));
			const parts = [];
			for (let i = 2; i < a.length; i++) for (const v of c.rangeValues(a[i])) {
				const s = str(v);
				if (ignoreEmpty && s === "") continue;
				parts.push(s);
			}
			return parts.join(delim);
		},
		LEFT: (a, c) => argStr(a, 0, c).slice(0, Math.max(0, Math.round(argNum(a, 1, c, 1)))),
		RIGHT: (a, c) => {
			const s = argStr(a, 0, c);
			const n = Math.max(0, Math.round(argNum(a, 1, c, 1)));
			return n === 0 ? "" : s.slice(Math.max(0, s.length - n));
		},
		MID: (a, c) => {
			const s = argStr(a, 0, c);
			const start = Math.max(1, Math.round(argNum(a, 1, c)));
			const len = Math.max(0, Math.round(argNum(a, 2, c)));
			return s.slice(start - 1, start - 1 + len);
		},
		LEN: (a, c) => argStr(a, 0, c).length,
		LOWER: (a, c) => argStr(a, 0, c).toLowerCase(),
		UPPER: (a, c) => argStr(a, 0, c).toUpperCase(),
		PROPER: (a, c) => argStr(a, 0, c).replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
		TRIM: (a, c) => argStr(a, 0, c).trim().replace(/\s+/g, " "),
		SUBSTITUTE: (a, c) => {
			const s = argStr(a, 0, c);
			const oldT = argStr(a, 1, c);
			const newT = argStr(a, 2, c);
			if (oldT === "") return s;
			if (a[3] !== void 0) {
				const instance = Math.round(argNum(a, 3, c));
				let count = 0;
				let idx = -1;
				let searchFrom = 0;
				while (true) {
					idx = s.indexOf(oldT, searchFrom);
					if (idx === -1) return s;
					count++;
					if (count === instance) return s.slice(0, idx) + newT + s.slice(idx + oldT.length);
					searchFrom = idx + oldT.length;
				}
			}
			return s.split(oldT).join(newT);
		},
		REPT: (a, c) => argStr(a, 0, c).repeat(Math.max(0, Math.round(argNum(a, 1, c)))),
		FIND: (a, c) => {
			const find = argStr(a, 0, c);
			const within = argStr(a, 1, c);
			const start = Math.max(1, Math.round(argNum(a, 2, c, 1)));
			const idx = within.indexOf(find, start - 1);
			if (idx === -1) return new FErr("#VALUE!");
			return idx + 1;
		},
		SEARCH: (a, c) => {
			const find = argStr(a, 0, c).toLowerCase();
			const within = argStr(a, 1, c).toLowerCase();
			const start = Math.max(1, Math.round(argNum(a, 2, c, 1)));
			const idx = within.indexOf(find, start - 1);
			if (idx === -1) return new FErr("#VALUE!");
			return idx + 1;
		},
		EXACT: (a, c) => argStr(a, 0, c) === argStr(a, 1, c),
		VALUE: (a, c) => {
			const n = toNumber(argStr(a, 0, c).trim());
			if (isErr(n)) return new FErr("#VALUE!");
			return n;
		},
		VLOOKUP: (a, c) => {
			var _grid$0$length, _grid$;
			const lookup = arg(a, 0, c);
			const grid = c.rangeGrid(a[1]);
			const colIdx = Math.round(argNum(a, 2, c));
			const approx = a[3] !== void 0 ? bool(arg(a, 3, c)) : true;
			if (colIdx < 1 || colIdx > ((_grid$0$length = (_grid$ = grid[0]) === null || _grid$ === void 0 ? void 0 : _grid$.length) !== null && _grid$0$length !== void 0 ? _grid$0$length : 0)) return new FErr("#REF!");
			if (approx) {
				let best = -1;
				for (let i = 0; i < grid.length; i++) if (compareLookup(grid[i][0], lookup) <= 0) best = i;
				else break;
				if (best === -1) return new FErr("#VALUE!");
				return grid[best][colIdx - 1];
			}
			for (const row of grid) if (valuesEqual(row[0], lookup)) return row[colIdx - 1];
			return new FErr("#VALUE!");
		},
		HLOOKUP: (a, c) => {
			var _grid$2;
			const lookup = arg(a, 0, c);
			const grid = c.rangeGrid(a[1]);
			const rowIdx = Math.round(argNum(a, 2, c));
			const approx = a[3] !== void 0 ? bool(arg(a, 3, c)) : true;
			if (rowIdx < 1 || rowIdx > grid.length) return new FErr("#REF!");
			const header = (_grid$2 = grid[0]) !== null && _grid$2 !== void 0 ? _grid$2 : [];
			if (approx) {
				let best = -1;
				for (let i = 0; i < header.length; i++) if (compareLookup(header[i], lookup) <= 0) best = i;
				else break;
				if (best === -1) return new FErr("#VALUE!");
				return grid[rowIdx - 1][best];
			}
			for (let i = 0; i < header.length; i++) if (valuesEqual(header[i], lookup)) return grid[rowIdx - 1][i];
			return new FErr("#VALUE!");
		},
		INDEX: (a, c) => {
			var _grid$0$length3, _grid$4, _grid;
			const grid = c.rangeGrid(a[0]);
			const rowN = Math.round(argNum(a, 1, c, 0));
			if (grid.length === 1 && a.length === 2) {
				var _grid$0$length2, _grid$3;
				const idx = rowN;
				if (idx < 1 || idx > ((_grid$0$length2 = (_grid$3 = grid[0]) === null || _grid$3 === void 0 ? void 0 : _grid$3.length) !== null && _grid$0$length2 !== void 0 ? _grid$0$length2 : 0)) return new FErr("#REF!");
				return grid[0][idx - 1];
			}
			if (((_grid$0$length3 = (_grid$4 = grid[0]) === null || _grid$4 === void 0 ? void 0 : _grid$4.length) !== null && _grid$0$length3 !== void 0 ? _grid$0$length3 : 0) === 1 && a.length === 2) {
				const idx = rowN;
				if (idx < 1 || idx > grid.length) return new FErr("#REF!");
				return grid[idx - 1][0];
			}
			const colN = Math.round(argNum(a, 2, c, 1));
			if (rowN < 1 || rowN > grid.length) return new FErr("#REF!");
			const row = (_grid = grid[rowN - 1]) !== null && _grid !== void 0 ? _grid : [];
			if (colN < 1 || colN > row.length) return new FErr("#REF!");
			return row[colN - 1];
		},
		MATCH: (a, c) => {
			const lookup = arg(a, 0, c);
			const vals = c.rangeValues(a[1]);
			const matchType = a[2] !== void 0 ? Math.round(argNum(a, 2, c)) : 1;
			if (matchType === 0) {
				for (let i = 0; i < vals.length; i++) if (valuesEqual(vals[i], lookup)) return i + 1;
				return new FErr("#VALUE!");
			} else if (matchType > 0) {
				let best = -1;
				for (let i = 0; i < vals.length; i++) if (compareLookup(vals[i], lookup) <= 0) best = i;
				else break;
				if (best === -1) return new FErr("#VALUE!");
				return best + 1;
			} else {
				let best = -1;
				for (let i = 0; i < vals.length; i++) if (compareLookup(vals[i], lookup) >= 0) best = i;
				else break;
				if (best === -1) return new FErr("#VALUE!");
				return best + 1;
			}
		},
		CHOOSE: (a, c) => {
			const idx = Math.round(argNum(a, 0, c));
			if (idx < 1 || idx >= a.length) return new FErr("#VALUE!");
			return arg(a, idx, c);
		},
		TODAY: (_a, c) => Math.floor(jsDateToSerial(c.now)),
		NOW: (_a, c) => jsDateToSerial(c.now),
		DATE: (a, c) => dateToSerial(argNum(a, 0, c), argNum(a, 1, c), argNum(a, 2, c)),
		YEAR: (a, c) => serialParts(argNum(a, 0, c)).year,
		MONTH: (a, c) => serialParts(argNum(a, 0, c)).month,
		DAY: (a, c) => serialParts(argNum(a, 0, c)).day,
		HOUR: (a, c) => serialParts(argNum(a, 0, c)).hour,
		MINUTE: (a, c) => serialParts(argNum(a, 0, c)).minute,
		WEEKDAY: (a, c) => {
			const wd = serialParts(argNum(a, 0, c)).weekday;
			const type = a[1] !== void 0 ? Math.round(argNum(a, 1, c)) : 1;
			if (type === 2) return (wd + 6) % 7 + 1;
			if (type === 3) return (wd + 6) % 7;
			return wd + 1;
		},
		DAYS: (a, c) => argNum(a, 0, c) - argNum(a, 1, c),
		SUMIFS: (a, c) => {
			const sumVals = c.rangeValues(a[0]);
			const matches = matchAllCriteria(a, c, 1, sumVals.length);
			let total = 0;
			for (let i = 0; i < sumVals.length; i++) {
				if (!matches[i]) continue;
				const n = toNumber(sumVals[i]);
				if (!isErr(n)) total += n;
			}
			return total;
		},
		COUNTIFS: (a, c) => {
			return matchAllCriteria(a, c, 0, a[0] ? c.rangeValues(a[0]).length : 0).filter(Boolean).length;
		},
		AVERAGEIFS: (a, c) => {
			const avgVals = c.rangeValues(a[0]);
			const matches = matchAllCriteria(a, c, 1, avgVals.length);
			let total = 0;
			let count = 0;
			for (let i = 0; i < avgVals.length; i++) {
				if (!matches[i]) continue;
				const n = toNumber(avgVals[i]);
				if (!isErr(n)) {
					total += n;
					count++;
				}
			}
			if (count === 0) return new FErr("#DIV/0!");
			return total / count;
		},
		MAXIFS: (a, c) => {
			var _best;
			const vals = c.rangeValues(a[0]);
			const matches = matchAllCriteria(a, c, 1, vals.length);
			let best = null;
			for (let i = 0; i < vals.length; i++) {
				if (!matches[i]) continue;
				const n = toNumber(vals[i]);
				if (!isErr(n) && (best === null || n > best)) best = n;
			}
			return (_best = best) !== null && _best !== void 0 ? _best : 0;
		},
		MINIFS: (a, c) => {
			var _best2;
			const vals = c.rangeValues(a[0]);
			const matches = matchAllCriteria(a, c, 1, vals.length);
			let best = null;
			for (let i = 0; i < vals.length; i++) {
				if (!matches[i]) continue;
				const n = toNumber(vals[i]);
				if (!isErr(n) && (best === null || n < best)) best = n;
			}
			return (_best2 = best) !== null && _best2 !== void 0 ? _best2 : 0;
		},
		XLOOKUP: (a, c) => {
			const lookup = arg(a, 0, c);
			const lookupArr = c.rangeValues(a[1]);
			const returnArr = c.rangeValues(a[2]);
			if (lookupArr.length !== returnArr.length) return new FErr("#VALUE!");
			const matchMode = a[4] !== void 0 ? Math.round(argNum(a, 4, c)) : 0;
			let foundIdx = -1;
			if (matchMode === 0) {
				for (let i = 0; i < lookupArr.length; i++) if (valuesEqual(lookupArr[i], lookup)) {
					foundIdx = i;
					break;
				}
			} else if (matchMode === -1) {
				let bestIdx = -1;
				for (let i = 0; i < lookupArr.length; i++) {
					if (valuesEqual(lookupArr[i], lookup)) {
						foundIdx = i;
						break;
					}
					if (compareLookup(lookupArr[i], lookup) < 0 && (bestIdx === -1 || compareLookup(lookupArr[i], lookupArr[bestIdx]) > 0)) bestIdx = i;
				}
				if (foundIdx === -1) foundIdx = bestIdx;
			} else if (matchMode === 1) {
				let bestIdx = -1;
				for (let i = 0; i < lookupArr.length; i++) {
					if (valuesEqual(lookupArr[i], lookup)) {
						foundIdx = i;
						break;
					}
					if (compareLookup(lookupArr[i], lookup) > 0 && (bestIdx === -1 || compareLookup(lookupArr[i], lookupArr[bestIdx]) < 0)) bestIdx = i;
				}
				if (foundIdx === -1) foundIdx = bestIdx;
			} else return new FErr("#VALUE!");
			if (foundIdx === -1) {
				if (a[3] !== void 0) return arg(a, 3, c);
				return new FErr("#N/A");
			}
			return returnArr[foundIdx];
		},
		ROW: (a, c) => {
			if (a[0] === void 0) {
				if (!c.currentRef) return new FErr("#REF!");
				const p = parseCellRef(c.currentRef);
				return p ? p.row + 1 : new FErr("#REF!");
			}
			const refs = c.rangeRefs(a[0]);
			if (!refs.length) return new FErr("#VALUE!");
			const p = parseCellRef(refs[0]);
			return p ? p.row + 1 : new FErr("#REF!");
		},
		COLUMN: (a, c) => {
			if (a[0] === void 0) {
				if (!c.currentRef) return new FErr("#REF!");
				const p = parseCellRef(c.currentRef);
				return p ? p.col + 1 : new FErr("#REF!");
			}
			const refs = c.rangeRefs(a[0]);
			if (!refs.length) return new FErr("#VALUE!");
			const p = parseCellRef(refs[0]);
			return p ? p.col + 1 : new FErr("#REF!");
		},
		ROWS: (a, c) => c.rangeGrid(a[0]).length,
		COLUMNS: (a, c) => {
			var _c$rangeGrid$0$length, _c$rangeGrid$;
			return (_c$rangeGrid$0$length = (_c$rangeGrid$ = c.rangeGrid(a[0])[0]) === null || _c$rangeGrid$ === void 0 ? void 0 : _c$rangeGrid$.length) !== null && _c$rangeGrid$0$length !== void 0 ? _c$rangeGrid$0$length : 0;
		},
		SUMPRODUCT: (a, c) => {
			var _grids$0$length, _grids$;
			if (a.length === 0) return 0;
			const grids = a.map((n) => c.rangeValues(n));
			const len = (_grids$0$length = (_grids$ = grids[0]) === null || _grids$ === void 0 ? void 0 : _grids$.length) !== null && _grids$0$length !== void 0 ? _grids$0$length : 0;
			if (grids.some((g) => g.length !== len)) return new FErr("#VALUE!");
			let total = 0;
			for (let i = 0; i < len; i++) {
				let prod = 1;
				for (const g of grids) {
					var _g$i;
					const n = toNumber((_g$i = g[i]) !== null && _g$i !== void 0 ? _g$i : 0);
					if (isErr(n)) throw n;
					prod *= n;
				}
				total += prod;
			}
			return total;
		},
		SUMSQ: (a, c) => flattenNumbers(a, c).reduce((s, n) => s + n * n, 0),
		GCD: (a, c) => {
			const ns = flattenNumbers(a, c).map((n) => Math.trunc(n));
			if (ns.some((n) => n < 0)) return new FErr("#NUM!");
			if (!ns.length) return 0;
			return ns.reduce((g, n) => gcd2(g, n));
		},
		LCM: (a, c) => {
			const ns = flattenNumbers(a, c).map((n) => Math.trunc(n));
			if (ns.some((n) => n < 0)) return new FErr("#NUM!");
			if (!ns.length) return 0;
			if (ns.some((n) => n === 0)) return 0;
			return ns.reduce((l, n) => l * n / gcd2(l, n));
		},
		COMBIN: (a, c) => {
			const n = Math.floor(argNum(a, 0, c));
			const k = Math.floor(argNum(a, 1, c));
			if (n < 0 || k < 0 || k > n) return new FErr("#NUM!");
			return Math.round(factorial(n) / (factorial(k) * factorial(n - k)));
		},
		PERMUT: (a, c) => {
			const n = Math.floor(argNum(a, 0, c));
			const k = Math.floor(argNum(a, 1, c));
			if (n < 0 || k < 0 || k > n) return new FErr("#NUM!");
			return Math.round(factorial(n) / factorial(n - k));
		},
		FACT: (a, c) => {
			const n = Math.floor(argNum(a, 0, c));
			if (n < 0) return new FErr("#NUM!");
			return factorial(n);
		},
		QUOTIENT: (a, c) => {
			const n = argNum(a, 0, c);
			const d = argNum(a, 1, c);
			if (d === 0) return new FErr("#DIV/0!");
			return Math.trunc(n / d);
		},
		MROUND: (a, c) => {
			const n = argNum(a, 0, c);
			const mult = argNum(a, 1, c);
			if (mult === 0) return 0;
			if (n < 0 && mult > 0 || n > 0 && mult < 0) return new FErr("#NUM!");
			return Math.round(n / mult) * mult;
		},
		EVEN: (a, c) => {
			const n = argNum(a, 0, c);
			return (n < 0 ? -1 : 1) * Math.ceil(Math.abs(n) / 2) * 2;
		},
		ODD: (a, c) => {
			const n = argNum(a, 0, c);
			const sign = n < 0 ? -1 : 1;
			let r = Math.ceil(Math.abs(n));
			if (r % 2 === 0) r += 1;
			return sign * r;
		},
		RADIANS: (a, c) => argNum(a, 0, c) * Math.PI / 180,
		DEGREES: (a, c) => argNum(a, 0, c) * 180 / Math.PI,
		SIN: (a, c) => Math.sin(argNum(a, 0, c)),
		COS: (a, c) => Math.cos(argNum(a, 0, c)),
		TAN: (a, c) => Math.tan(argNum(a, 0, c)),
		ASIN: (a, c) => {
			const n = argNum(a, 0, c);
			if (n < -1 || n > 1) return new FErr("#NUM!");
			return Math.asin(n);
		},
		ACOS: (a, c) => {
			const n = argNum(a, 0, c);
			if (n < -1 || n > 1) return new FErr("#NUM!");
			return Math.acos(n);
		},
		ATAN: (a, c) => Math.atan(argNum(a, 0, c)),
		ATAN2: (a, c) => Math.atan2(argNum(a, 1, c), argNum(a, 0, c)),
		SINH: (a, c) => Math.sinh(argNum(a, 0, c)),
		COSH: (a, c) => Math.cosh(argNum(a, 0, c)),
		TANH: (a, c) => Math.tanh(argNum(a, 0, c)),
		PERCENTILE: (a, c) => percentileOf(flattenNumbers([a[0]], c), argNum(a, 1, c)),
		QUARTILE: (a, c) => {
			const q = Math.round(argNum(a, 1, c));
			if (q < 0 || q > 4) return new FErr("#NUM!");
			return percentileOf(flattenNumbers([a[0]], c), q / 4);
		},
		STDEVP: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (!ns.length) return new FErr("#DIV/0!");
			const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
			return Math.sqrt(ns.reduce((s, n) => s + (n - mean) ** 2, 0) / ns.length);
		},
		VARP: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (!ns.length) return new FErr("#DIV/0!");
			const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
			return ns.reduce((s, n) => s + (n - mean) ** 2, 0) / ns.length;
		},
		GEOMEAN: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (!ns.length) return new FErr("#DIV/0!");
			if (ns.some((n) => n <= 0)) return new FErr("#NUM!");
			return Math.pow(ns.reduce((s, n) => s * n, 1), 1 / ns.length);
		},
		AVEDEV: (a, c) => {
			const ns = flattenNumbers(a, c);
			if (!ns.length) return new FErr("#DIV/0!");
			const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
			return ns.reduce((s, n) => s + Math.abs(n - mean), 0) / ns.length;
		},
		CORREL: (a, c) => {
			const [xs, ys] = pairedNumbers(a[0], a[1], c);
			if (xs.length < 2) return new FErr("#DIV/0!");
			const mx = xs.reduce((s, n) => s + n, 0) / xs.length;
			const my = ys.reduce((s, n) => s + n, 0) / ys.length;
			let num = 0;
			let dx2 = 0;
			let dy2 = 0;
			for (let i = 0; i < xs.length; i++) {
				const dx = xs[i] - mx;
				const dy = ys[i] - my;
				num += dx * dy;
				dx2 += dx * dx;
				dy2 += dy * dy;
			}
			if (dx2 === 0 || dy2 === 0) return new FErr("#DIV/0!");
			return num / Math.sqrt(dx2 * dy2);
		},
		SLOPE: (a, c) => {
			const [ys, xs] = pairedNumbers(a[0], a[1], c);
			const r = linreg(ys, xs);
			if (r instanceof FErr) return r;
			return r.slope;
		},
		INTERCEPT: (a, c) => {
			const [ys, xs] = pairedNumbers(a[0], a[1], c);
			const r = linreg(ys, xs);
			if (r instanceof FErr) return r;
			return r.intercept;
		},
		RSQ: (a, c) => {
			const [xs, ys] = pairedNumbers(a[0], a[1], c);
			if (xs.length < 2) return new FErr("#DIV/0!");
			const mx = xs.reduce((s, n) => s + n, 0) / xs.length;
			const my = ys.reduce((s, n) => s + n, 0) / ys.length;
			let num = 0;
			let dx2 = 0;
			let dy2 = 0;
			for (let i = 0; i < xs.length; i++) {
				const dx = xs[i] - mx;
				const dy = ys[i] - my;
				num += dx * dy;
				dx2 += dx * dx;
				dy2 += dy * dy;
			}
			if (dx2 === 0 || dy2 === 0) return new FErr("#DIV/0!");
			const r = num / Math.sqrt(dx2 * dy2);
			return r * r;
		},
		FORECAST: (a, c) => {
			const x = argNum(a, 0, c);
			const [ys, xs] = pairedNumbers(a[1], a[2], c);
			const r = linreg(ys, xs);
			if (r instanceof FErr) return r;
			return r.intercept + r.slope * x;
		},
		COUNTUNIQUE: (a, c) => {
			const set = /* @__PURE__ */ new Set();
			for (const n of a) for (const v of c.rangeValues(n)) {
				if (v === "") continue;
				if (typeof v === "string") set.add("S:" + v.toLowerCase());
				else if (typeof v === "number") set.add("N:" + v);
				else if (typeof v === "boolean") set.add("B:" + v);
				else set.add("E:" + v.code);
			}
			return set.size;
		},
		PMT: (a, c) => {
			const rate = argNum(a, 0, c);
			const nper = argNum(a, 1, c);
			const pv = argNum(a, 2, c);
			const fv = argNum(a, 3, c, 0);
			const type = argNum(a, 4, c, 0);
			if (rate === 0) return -(pv + fv) / nper;
			const pow = Math.pow(1 + rate, nper);
			return -(pv * pow + fv) * rate / ((pow - 1) * (1 + rate * type));
		},
		FV: (a, c) => {
			const rate = argNum(a, 0, c);
			const nper = argNum(a, 1, c);
			const pmt = argNum(a, 2, c);
			const pv = argNum(a, 3, c, 0);
			const type = argNum(a, 4, c, 0);
			if (rate === 0) return -(pv + pmt * nper);
			const pow = Math.pow(1 + rate, nper);
			return -(pv * pow + pmt * (1 + rate * type) * (pow - 1) / rate);
		},
		PV: (a, c) => {
			const rate = argNum(a, 0, c);
			const nper = argNum(a, 1, c);
			const pmt = argNum(a, 2, c);
			const fv = argNum(a, 3, c, 0);
			const type = argNum(a, 4, c, 0);
			if (rate === 0) return -(fv + pmt * nper);
			const pow = Math.pow(1 + rate, nper);
			return -(fv + pmt * (1 + rate * type) * (pow - 1) / rate) / pow;
		},
		NPER: (a, c) => {
			const rate = argNum(a, 0, c);
			const pmt = argNum(a, 1, c);
			const pv = argNum(a, 2, c);
			const fv = argNum(a, 3, c, 0);
			const type = argNum(a, 4, c, 0);
			if (rate === 0) {
				if (pmt === 0) return new FErr("#DIV/0!");
				return -(pv + fv) / pmt;
			}
			const num_ = pmt * (1 + rate * type) - fv * rate;
			const den = pmt * (1 + rate * type) + pv * rate;
			if (den === 0 || num_ / den <= 0) return new FErr("#NUM!");
			return Math.log(num_ / den) / Math.log(1 + rate);
		},
		RATE: (a, c) => {
			const nper = argNum(a, 0, c);
			const pmt = argNum(a, 1, c);
			const pv = argNum(a, 2, c);
			const fv = argNum(a, 3, c, 0);
			const type = argNum(a, 4, c, 0);
			let rate = argNum(a, 5, c, .1);
			const f = (r) => {
				if (r === 0) return pv + pmt * nper + fv;
				const pow = Math.pow(1 + r, nper);
				return pv * pow + pmt * (1 + r * type) * (pow - 1) / r + fv;
			};
			for (let i = 0; i < 50; i++) {
				const fx = f(rate);
				const h = 1e-6;
				const dfx = (f(rate + h) - f(rate - h)) / (2 * h);
				if (dfx === 0 || !Number.isFinite(dfx)) return new FErr("#VALUE!");
				const next = rate - fx / dfx;
				if (!Number.isFinite(next) || next <= -1) return new FErr("#VALUE!");
				if (Math.abs(next - rate) < 1e-10) return next;
				rate = next;
			}
			return new FErr("#VALUE!");
		},
		NPV: (a, c) => {
			const rate = argNum(a, 0, c);
			const vals = flattenNumbers(a.slice(1), c);
			let total = 0;
			for (let i = 0; i < vals.length; i++) total += vals[i] / Math.pow(1 + rate, i + 1);
			return total;
		},
		IRR: (a, c) => {
			const vals = flattenNumbers([a[0]], c);
			if (vals.length < 2) return new FErr("#NUM!");
			if (!vals.some((v) => v > 0) || !vals.some((v) => v < 0)) return new FErr("#NUM!");
			const guess = a[1] !== void 0 ? argNum(a, 1, c) : .1;
			const npvAt = (r) => vals.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0);
			const npvPrimeAt = (r) => vals.reduce((s, v, i) => s - i * v / Math.pow(1 + r, i + 1), 0);
			let rate = guess;
			let converged = false;
			for (let i = 0; i < 50; i++) {
				const fx = npvAt(rate);
				const dfx = npvPrimeAt(rate);
				if (dfx === 0 || !Number.isFinite(dfx)) break;
				const next = rate - fx / dfx;
				if (!Number.isFinite(next) || next <= -1) break;
				if (Math.abs(next - rate) < 1e-9) {
					rate = next;
					converged = true;
					break;
				}
				rate = next;
			}
			if (converged) return rate;
			let lo = -.999999;
			let hi = 10;
			let flo = npvAt(lo);
			let fhi = npvAt(hi);
			if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) {
				let found = false;
				for (let h = 10; h <= 1e6; h *= 10) {
					fhi = npvAt(h);
					if (flo * fhi <= 0) {
						hi = h;
						found = true;
						break;
					}
				}
				if (!found) return new FErr("#NUM!");
			}
			for (let i = 0; i < 200; i++) {
				const mid = (lo + hi) / 2;
				const fmid = npvAt(mid);
				if (Math.abs(fmid) < 1e-9) return mid;
				if (flo * fmid < 0) hi = mid;
				else {
					lo = mid;
					flo = fmid;
				}
			}
			return (lo + hi) / 2;
		},
		EDATE: (a, c) => addMonths(argNum(a, 0, c), Math.round(argNum(a, 1, c))),
		EOMONTH: (a, c) => {
			const dt = serialToDate(argNum(a, 0, c));
			const y = dt.getUTCFullYear();
			const total = dt.getUTCMonth() + Math.round(argNum(a, 1, c));
			const targetY = y + Math.floor(total / 12);
			const targetM = (total % 12 + 12) % 12;
			const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
			return dateToSerial(targetY, targetM + 1, lastDay);
		},
		WORKDAY: (a, c) => {
			const start = Math.floor(argNum(a, 0, c));
			const days = Math.round(argNum(a, 1, c));
			const holidays = /* @__PURE__ */ new Set();
			if (a[2] !== void 0) for (const v of c.rangeValues(a[2])) {
				const n = toNumber(v);
				if (!isErr(n)) holidays.add(Math.floor(n));
			}
			const step = days >= 0 ? 1 : -1;
			let remaining = Math.abs(days);
			let cur = start;
			while (remaining > 0) {
				cur += step;
				if (isWeekend(serialToDate(cur))) continue;
				if (holidays.has(cur)) continue;
				remaining--;
			}
			return cur;
		},
		NETWORKDAYS: (a, c) => {
			const start = Math.floor(argNum(a, 0, c));
			const end = Math.floor(argNum(a, 1, c));
			const holidays = /* @__PURE__ */ new Set();
			if (a[2] !== void 0) for (const v of c.rangeValues(a[2])) {
				const n = toNumber(v);
				if (!isErr(n)) holidays.add(Math.floor(n));
			}
			const sign = start <= end ? 1 : -1;
			const lo = Math.min(start, end);
			const hi = Math.max(start, end);
			let count = 0;
			for (let d = lo; d <= hi; d++) {
				if (isWeekend(serialToDate(d))) continue;
				if (holidays.has(d)) continue;
				count++;
			}
			return sign * count;
		},
		DATEDIF: (a, c) => {
			const startSerial = Math.floor(argNum(a, 0, c));
			const endSerial = Math.floor(argNum(a, 1, c));
			const unit = argStr(a, 2, c).toUpperCase();
			if (startSerial > endSerial) return new FErr("#NUM!");
			const sd = serialToDate(startSerial);
			const ed = serialToDate(endSerial);
			const sy = sd.getUTCFullYear(), sm = sd.getUTCMonth(), sday = sd.getUTCDate();
			const ey = ed.getUTCFullYear(), em = ed.getUTCMonth(), eday = ed.getUTCDate();
			switch (unit) {
				case "Y": {
					let years = ey - sy;
					if (em < sm || em === sm && eday < sday) years--;
					return years;
				}
				case "M": {
					let months = (ey - sy) * 12 + (em - sm);
					if (eday < sday) months--;
					return months;
				}
				case "D": return endSerial - startSerial;
				case "MD": {
					let d = eday - sday;
					if (d < 0) {
						const prevMonthLastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
						d += prevMonthLastDay;
					}
					return d;
				}
				case "YM": {
					let months = em - sm;
					if (eday < sday) months--;
					if (months < 0) months += 12;
					return months;
				}
				case "YD": {
					let annivSerial = Math.round(jsDateToSerial(new Date(Date.UTC(ey, sm, sday))));
					if (annivSerial > endSerial) annivSerial = Math.round(jsDateToSerial(new Date(Date.UTC(ey - 1, sm, sday))));
					return endSerial - annivSerial;
				}
				default: return new FErr("#NUM!");
			}
		},
		DATEVALUE: (a, c) => {
			const s = argStr(a, 0, c).trim();
			let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
			if (m) return dateToSerial(Number(m[1]), Number(m[2]), Number(m[3]));
			m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
			if (m) return dateToSerial(Number(m[3]), Number(m[1]), Number(m[2]));
			return new FErr("#VALUE!");
		},
		WEEKNUM: (a, c) => {
			const serial = Math.floor(argNum(a, 0, c));
			const jan1 = dateToSerial(serialToDate(serial).getUTCFullYear(), 1, 1);
			const jan1Weekday = serialToDate(jan1).getUTCDay();
			return Math.floor((serial - jan1 + jan1Weekday) / 7) + 1;
		},
		SWITCH: (a, c) => {
			const expr = arg(a, 0, c);
			let i = 1;
			for (; i + 1 < a.length; i += 2) if (valuesEqual(expr, arg(a, i, c))) return arg(a, i + 1, c);
			if (i < a.length) return arg(a, i, c);
			return new FErr("#N/A");
		},
		IFNA: (a, c) => {
			const v = c.evalNode(a[0]);
			if (isErr(v) && v.code === "#N/A") return c.evalNode(a[1]);
			return v;
		},
		ISERROR: (a, c) => isErr(c.evalNode(a[0])),
		ISERR: (a, c) => {
			const v = c.evalNode(a[0]);
			return isErr(v) && v.code !== "#N/A";
		},
		ISNA: (a, c) => {
			const v = c.evalNode(a[0]);
			return isErr(v) && v.code === "#N/A";
		},
		ISEVEN: (a, c) => {
			const v = c.evalNode(a[0]);
			if (isErr(v)) return v;
			const n = toNumber(v);
			if (isErr(n)) return n;
			return Math.floor(Math.abs(n)) % 2 === 0;
		},
		ISODD: (a, c) => {
			const v = c.evalNode(a[0]);
			if (isErr(v)) return v;
			const n = toNumber(v);
			if (isErr(n)) return n;
			return Math.floor(Math.abs(n)) % 2 !== 0;
		},
		ISLOGICAL: (a, c) => typeof c.evalNode(a[0]) === "boolean",
		NA: () => new FErr("#N/A"),
		CHAR: (a, c) => {
			const n = Math.round(argNum(a, 0, c));
			if (n < 1 || n > 255) return new FErr("#VALUE!");
			return String.fromCharCode(n);
		},
		CODE: (a, c) => {
			const s = argStr(a, 0, c);
			if (s.length === 0) return new FErr("#VALUE!");
			return s.charCodeAt(0);
		},
		CLEAN: (a, c) => argStr(a, 0, c).replace(/[\x00-\x1F]/g, ""),
		UNICHAR: (a, c) => {
			const n = Math.round(argNum(a, 0, c));
			if (n < 1) return new FErr("#VALUE!");
			return String.fromCodePoint(n);
		},
		UNICODE: (a, c) => {
			const s = argStr(a, 0, c);
			if (s.length === 0) return new FErr("#VALUE!");
			return s.codePointAt(0);
		},
		FIXED: (a, c) => {
			const n = argNum(a, 0, c);
			const decimals = a[1] !== void 0 ? Math.round(argNum(a, 1, c)) : 2;
			const noCommas = a[2] !== void 0 ? bool(arg(a, 2, c)) : false;
			const d = Math.max(decimals, 0);
			const parts = round(n, decimals).toFixed(d).split(".");
			if (!noCommas) {
				const neg = parts[0].startsWith("-");
				const digits = neg ? parts[0].slice(1) : parts[0];
				parts[0] = (neg ? "-" : "") + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			}
			return parts.length > 1 ? parts.join(".") : parts[0];
		},
		NUMBERVALUE: (a, c) => {
			const s = argStr(a, 0, c).trim();
			const decSep = argStr(a, 1, c, ".");
			const groupSep = argStr(a, 2, c, ",");
			if (s === "") return new FErr("#VALUE!");
			let cleaned = s.split(groupSep).join("");
			cleaned = cleaned.split(decSep).join(".");
			const n = Number(cleaned);
			if (Number.isNaN(n)) return new FErr("#VALUE!");
			return n;
		}
	};
	//#endregion
	//#region src/apps/sheets/engine/format.ts
	function plainNumber(n, decimals) {
		if (decimals !== void 0) return n.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		if (Number.isInteger(n)) return n.toLocaleString("en-US");
		return n.toLocaleString("en-US", { maximumFractionDigits: 10 });
	}
	function currencyStr(n, decimals) {
		return n.toLocaleString("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}
	function percentStr(n, decimals) {
		return (n * 100).toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		}) + "%";
	}
	function dateStr(serial) {
		return serialToDate(serial).toLocaleDateString("en-US", {
			year: "numeric",
			month: "numeric",
			day: "numeric",
			timeZone: "UTC"
		});
	}
	function formatValue(v, style) {
		var _style$format;
		if (v instanceof FErr) return v.code;
		const fmt = (_style$format = style === null || style === void 0 ? void 0 : style.format) !== null && _style$format !== void 0 ? _style$format : "auto";
		const decimals = style === null || style === void 0 ? void 0 : style.decimals;
		if (fmt === "text") return toDisplayString(v);
		if (typeof v === "number") switch (fmt) {
			case "percent": return percentStr(v, decimals !== null && decimals !== void 0 ? decimals : 0);
			case "currency": return currencyStr(v, decimals !== null && decimals !== void 0 ? decimals : 2);
			case "number": return plainNumber(v, decimals !== null && decimals !== void 0 ? decimals : 2);
			case "date": return dateStr(v);
			default: return plainNumber(v, decimals);
		}
		return toDisplayString(v);
	}
	//#endregion
	//#region src/apps/sheets/engine/formula.ts
	var OPS2 = [
		"<=",
		">=",
		"<>"
	];
	var OPS1 = [
		"+",
		"-",
		"*",
		"/",
		"^",
		"&",
		"=",
		"<",
		">"
	];
	function tokenize(src) {
		const tokens = [];
		const n = src.length;
		let i = 0;
		while (i < n) {
			const c = src[i];
			if (c === " " || c === "	" || c === "\n" || c === "\r") {
				i++;
				continue;
			}
			if (c === "\"") {
				let j = i + 1;
				let val = "";
				while (j < n) {
					if (src[j] === "\"") {
						if (src[j + 1] === "\"") {
							val += "\"";
							j += 2;
							continue;
						}
						break;
					}
					val += src[j];
					j++;
				}
				tokens.push({
					type: "STR",
					value: val,
					start: i,
					end: j + 1
				});
				i = j + 1;
				continue;
			}
			if (c >= "0" && c <= "9") {
				const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
				tokens.push({
					type: "NUM",
					value: m[0],
					start: i,
					end: i + m[0].length
				});
				i += m[0].length;
				continue;
			}
			if (/[A-Za-z_]/.test(c)) {
				const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))[0];
				const end = i + m.length;
				let k = end;
				while (k < n && /\s/.test(src[k])) k++;
				const followedByParen = src[k] === "(";
				const looksLikeRef = /^[A-Za-z]{1,3}\d+$/.test(m);
				if (!followedByParen && looksLikeRef) tokens.push({
					type: "REF",
					value: m,
					start: i,
					end
				});
				else tokens.push({
					type: "IDENT",
					value: m,
					start: i,
					end
				});
				i = end;
				continue;
			}
			if (c === "$") {
				const m = /^\$[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i));
				if (m) {
					tokens.push({
						type: "REF",
						value: m[0],
						start: i,
						end: i + m[0].length
					});
					i += m[0].length;
					continue;
				}
				i++;
				continue;
			}
			if (c === "(") {
				tokens.push({
					type: "LPAREN",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			if (c === ")") {
				tokens.push({
					type: "RPAREN",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			if (c === ",") {
				tokens.push({
					type: "COMMA",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			if (c === ":") {
				tokens.push({
					type: "COLON",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			if (c === "%") {
				tokens.push({
					type: "PCT",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			const two = src.slice(i, i + 2);
			if (OPS2.includes(two)) {
				tokens.push({
					type: "OP",
					value: two,
					start: i,
					end: i + 2
				});
				i += 2;
				continue;
			}
			if (OPS1.includes(c)) {
				tokens.push({
					type: "OP",
					value: c,
					start: i,
					end: i + 1
				});
				i++;
				continue;
			}
			i++;
		}
		return tokens;
	}
	var ParseError = class extends Error {};
	var Parser = class {
		constructor(tokens) {
			_defineProperty(this, "tokens", void 0);
			_defineProperty(this, "pos", 0);
			this.tokens = tokens;
		}
		peek() {
			return this.tokens[this.pos];
		}
		next() {
			return this.tokens[this.pos++];
		}
		isOp(v) {
			const t = this.peek();
			return !!t && t.type === "OP" && t.value === v;
		}
		expect(type) {
			const t = this.next();
			if (!t || t.type !== type) throw new ParseError(`Expected ${type}`);
			return t;
		}
		parseExpr() {
			return this.parseComparison();
		}
		parseComparison() {
			let left = this.parseConcat();
			while (true) {
				const t = this.peek();
				if (t && t.type === "OP" && [
					"=",
					"<>",
					"<",
					">",
					"<=",
					">="
				].includes(t.value)) {
					this.next();
					const right = this.parseConcat();
					left = {
						t: "binop",
						op: t.value,
						l: left,
						r: right
					};
				} else break;
			}
			return left;
		}
		parseConcat() {
			let left = this.parseAdditive();
			while (this.isOp("&")) {
				this.next();
				const right = this.parseAdditive();
				left = {
					t: "binop",
					op: "&",
					l: left,
					r: right
				};
			}
			return left;
		}
		parseAdditive() {
			let left = this.parseMultiplicative();
			while (this.isOp("+") || this.isOp("-")) {
				const op = this.next().value;
				const right = this.parseMultiplicative();
				left = {
					t: "binop",
					op,
					l: left,
					r: right
				};
			}
			return left;
		}
		parseMultiplicative() {
			let left = this.parsePower();
			while (this.isOp("*") || this.isOp("/")) {
				const op = this.next().value;
				const right = this.parsePower();
				left = {
					t: "binop",
					op,
					l: left,
					r: right
				};
			}
			return left;
		}
		parsePower() {
			let left = this.parseUnary();
			while (this.isOp("^")) {
				this.next();
				const right = this.parseUnary();
				left = {
					t: "binop",
					op: "^",
					l: left,
					r: right
				};
			}
			return left;
		}
		parseUnary() {
			if (this.isOp("-")) {
				this.next();
				return {
					t: "unary",
					a: this.parseUnary()
				};
			}
			if (this.isOp("+")) {
				this.next();
				return this.parseUnary();
			}
			return this.parsePostfix();
		}
		parsePostfix() {
			var _this$peek;
			let node = this.parsePrimary();
			while (((_this$peek = this.peek()) === null || _this$peek === void 0 ? void 0 : _this$peek.type) === "PCT") {
				this.next();
				node = {
					t: "percent",
					a: node
				};
			}
			return node;
		}
		parsePrimary() {
			const t = this.peek();
			if (!t) throw new ParseError("Unexpected end of formula");
			if (t.type === "NUM") {
				this.next();
				return {
					t: "num",
					v: parseFloat(t.value)
				};
			}
			if (t.type === "STR") {
				this.next();
				return {
					t: "str",
					v: t.value
				};
			}
			if (t.type === "LPAREN") {
				this.next();
				const e = this.parseExpr();
				this.expect("RPAREN");
				return e;
			}
			if (t.type === "REF") {
				var _this$peek2;
				this.next();
				if (((_this$peek2 = this.peek()) === null || _this$peek2 === void 0 ? void 0 : _this$peek2.type) === "COLON") {
					this.next();
					const t2 = this.expect("REF");
					return {
						t: "range",
						from: t.value,
						to: t2.value
					};
				}
				return {
					t: "ref",
					ref: t.value
				};
			}
			if (t.type === "IDENT") {
				var _this$peek3;
				this.next();
				const upper = t.value.toUpperCase();
				if (upper === "TRUE") return {
					t: "bool",
					v: true
				};
				if (upper === "FALSE") return {
					t: "bool",
					v: false
				};
				if (((_this$peek3 = this.peek()) === null || _this$peek3 === void 0 ? void 0 : _this$peek3.type) === "LPAREN") {
					var _this$peek4;
					this.next();
					const args = [];
					if (((_this$peek4 = this.peek()) === null || _this$peek4 === void 0 ? void 0 : _this$peek4.type) !== "RPAREN") {
						var _this$peek5;
						args.push(this.parseExpr());
						while (((_this$peek5 = this.peek()) === null || _this$peek5 === void 0 ? void 0 : _this$peek5.type) === "COMMA") {
							this.next();
							args.push(this.parseExpr());
						}
					}
					this.expect("RPAREN");
					return {
						t: "call",
						name: upper,
						args
					};
				}
				return {
					t: "name",
					v: t.value
				};
			}
			throw new ParseError("Unexpected token: " + t.type);
		}
	};
	function parseFormula(body) {
		const tokens = tokenize(body);
		const p = new Parser(tokens);
		const node = p.parseExpr();
		if (p.pos < tokens.length) throw new ParseError("Trailing tokens");
		return node;
	}
	function evalCompare(op, l, r) {
		const cmp = compareValues(l, r);
		switch (op) {
			case "=": return cmp === 0;
			case "<>": return cmp !== 0;
			case "<": return cmp < 0;
			case ">": return cmp > 0;
			case "<=": return cmp <= 0;
			case ">=": return cmp >= 0;
		}
	}
	function evalNode(node, ctx) {
		switch (node.t) {
			case "num": return node.v;
			case "str": return node.v;
			case "bool": return node.v;
			case "name": return new FErr("#NAME?");
			case "ref": return ctx.getRef(node.ref);
			case "range": return new FErr("#VALUE!");
			case "unary": {
				const v = evalNode(node.a, ctx);
				if (isErr(v)) return v;
				const n = toNumber(v);
				if (isErr(n)) return n;
				return -n;
			}
			case "percent": {
				const v = evalNode(node.a, ctx);
				if (isErr(v)) return v;
				const n = toNumber(v);
				if (isErr(n)) return n;
				return n / 100;
			}
			case "binop": {
				const l = evalNode(node.l, ctx);
				if (isErr(l)) return l;
				const r = evalNode(node.r, ctx);
				if (isErr(r)) return r;
				if (node.op === "&") return toDisplayString(l) + toDisplayString(r);
				if (node.op === "+" || node.op === "-" || node.op === "*" || node.op === "/" || node.op === "^") {
					const ln = toNumber(l);
					if (isErr(ln)) return ln;
					const rn = toNumber(r);
					if (isErr(rn)) return rn;
					switch (node.op) {
						case "+": return ln + rn;
						case "-": return ln - rn;
						case "*": return ln * rn;
						case "/":
							if (rn === 0) return new FErr("#DIV/0!");
							return ln / rn;
						case "^": return Math.pow(ln, rn);
					}
				}
				return evalCompare(node.op, l, r);
			}
			case "call": {
				const fn = FUNCTIONS[node.name];
				if (!fn) return new FErr("#NAME?");
				try {
					return fn(node.args, ctx);
				} catch (e) {
					if (e instanceof FErr) return e;
					return new FErr("#VALUE!");
				}
			}
		}
	}
	function literalFromRaw(raw) {
		const s = raw.trim();
		if (s === "") return "";
		if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s);
		if (/^TRUE$/i.test(s)) return true;
		if (/^FALSE$/i.test(s)) return false;
		return raw;
	}
	/** Recomputes every populated cell in a sheet. Cycle-safe, memoized per pass. */
	function computeSheet(sheet) {
		const memo = /* @__PURE__ */ new Map();
		const evaluating = /* @__PURE__ */ new Set();
		const ctx = {
			now: /* @__PURE__ */ new Date(),
			getRef,
			evalNode: (n) => evalNode(n, ctx),
			rangeValues,
			rangeRefs,
			rangeGrid
		};
		function rawCellOf(key) {
			return sheet.cells[key];
		}
		function getRef(rawRef) {
			const parts = parseCellRef(rawRef);
			if (!parts) return new FErr("#REF!");
			const key = refToString(parts.col, parts.row);
			const cached = memo.get(key);
			if (cached) return cached.value;
			if (evaluating.has(key)) return new FErr("#CYCLE!");
			evaluating.add(key);
			const cell = rawCellOf(key);
			const raw = cell === null || cell === void 0 ? void 0 : cell.v;
			let value;
			if (raw === void 0 || raw === "") value = "";
			else if (raw.startsWith("=")) {
				const prevRef = ctx.currentRef;
				ctx.currentRef = key;
				try {
					value = evalNode(parseFormula(raw.slice(1)), ctx);
				} catch (_unused) {
					value = new FErr("#VALUE!");
				} finally {
					ctx.currentRef = prevRef;
				}
			} else value = literalFromRaw(raw);
			evaluating.delete(key);
			const entry = {
				value,
				display: formatValue(value, cell === null || cell === void 0 ? void 0 : cell.style)
			};
			memo.set(key, entry);
			return value;
		}
		function rangeBoundsFor(node) {
			if (node.t === "range") {
				const a = parseCellRef(node.from);
				const b = parseCellRef(node.to);
				if (!a || !b) return null;
				return rangeBounds(a, b);
			}
			if (node.t === "ref") {
				const a = parseCellRef(node.ref);
				if (!a) return null;
				return rangeBounds(a, a);
			}
			return null;
		}
		function rangeValues(node) {
			const b = rangeBoundsFor(node);
			if (!b) return [evalNode(node, ctx)];
			const out = [];
			for (let r = b.row1; r <= b.row2; r++) for (let c = b.col1; c <= b.col2; c++) out.push(getRef(refToString(c, r)));
			return out;
		}
		function rangeRefs(node) {
			const b = rangeBoundsFor(node);
			if (!b) return [];
			const out = [];
			for (let r = b.row1; r <= b.row2; r++) for (let c = b.col1; c <= b.col2; c++) out.push(refToString(c, r));
			return out;
		}
		function rangeGrid(node) {
			const b = rangeBoundsFor(node);
			if (!b) return [[evalNode(node, ctx)]];
			const grid = [];
			for (let r = b.row1; r <= b.row2; r++) {
				const row = [];
				for (let c = b.col1; c <= b.col2; c++) row.push(getRef(refToString(c, r)));
				grid.push(row);
			}
			return grid;
		}
		for (const key of Object.keys(sheet.cells)) {
			const cell = sheet.cells[key];
			if (!cell) continue;
			if (cell.v !== void 0 && cell.v !== "") getRef(key);
			else {
				const norm = parseCellRef(key);
				const nk = norm ? refToString(norm.col, norm.row) : key;
				memo.set(nk, {
					value: "",
					display: ""
				});
			}
		}
		return memo;
	}
	//#endregion
	//#region src/apps/sheets/engine/standalone.ts
	globalThis.AnleoEngine = { computeSheet };
	//#endregion
})();
