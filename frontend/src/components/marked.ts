import { mdiContentCopy } from '@mdi/js';
import { Marked, type MarkedToken } from 'marked';
import {
    NA,
    NBlockquote,
    NButton,
    NCode,
    NDivider,
    NEquation,
    NH1,
    NH2,
    NH3,
    NH4,
    NH5,
    NH6,
    NImage,
    NLi,
    NOl,
    NP,
    NTable,
    NTbody,
    NTd,
    NText,
    NTh,
    NThead,
    NTr,
    NUl,
} from 'naive-ui';
import { type FunctionalComponent, h, type VNode } from 'vue';
import NMdi from './mdi.vue';

const marked = new Marked();

// https://github.com/UziTech/marked-katex-extension/blob/main/src/index.js
const equationInlineRule =
    /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:？！。，：]|$)/;
const equationBlockRule = /^(\${1,2})\n((?:\\|[^\\])+?)\n\1(?:\n|$)/;
marked.use({
    extensions: [
        {
            name: 'equation_block',
            level: 'block',
            tokenizer: src => {
                const m = src.match(equationBlockRule);
                if (m)
                    return {
                        type: 'equation',
                        raw: m[0],
                        text: m[2].trim(),
                        displayMode: m[1].length === 2,
                    };
            },
        },
        {
            name: 'equation_inline',
            level: 'inline',
            start: src => {
                let index: number;
                let indexSrc = src;
                while (indexSrc) {
                    index = indexSrc.indexOf('$');
                    if (index === -1) return;
                    if (
                        (index === 0 || indexSrc.charAt(index - 1) === ' ') &&
                        indexSrc.substring(index).match(equationInlineRule)
                    )
                        return index;
                    indexSrc = indexSrc
                        .substring(index + 1)
                        .replace(/^\$+/, '');
                }
            },
            tokenizer: src => {
                const m = src.match(equationInlineRule);
                if (m)
                    return {
                        type: 'equation',
                        raw: m[0],
                        text: m[2].trim(),
                        displayMode: m[1].length === 2,
                    };
            },
        },
    ],
});

type EquationToken = {
    type: 'equation';
    raw: string;
    text: string;
    displayMode: boolean;
};

const decodeEntities = (s: string) =>
    s
        .replace(/&#(\d+);/g, (_, e: string) =>
            String.fromCharCode(parseInt(e, 10)),
        )
        .replace(/&x([\dA-F]+);/gi, (_, e: string) =>
            String.fromCharCode(parseInt(e, 16)),
        )
        .replace(
            /&(.+?);/gi,
            (m, e: string) =>
                ({
                    amp: '&',
                    apos: "'",
                    lt: '<',
                    gt: '>',
                    nbsp: ' ',
                    quot: '"',
                })[e] || m,
        );

const renderToken = (
    token: MarkedToken | EquationToken,
): string | number | boolean | VNode => {
    const r = (tokens: MarkedToken[]) => () => tokens.map(e => renderToken(e));
    switch (token.type) {
        case 'heading':
            return h(
                [NH1, NH2, NH3, NH4, NH5, NH6][token.depth - 1],
                r(token.tokens as MarkedToken[]),
            );
        case 'hr':
            return h(NDivider);
        case 'paragraph':
            return h(NP, r(token.tokens as MarkedToken[]));
        case 'html':
            return h(token.block ? 'div' : 'span', { innerHTML: token.text });
        case 'strong':
            return h(NText, { strong: true }, r(token.tokens as MarkedToken[]));
        case 'em':
            return h(NText, { italic: true }, r(token.tokens as MarkedToken[]));
        case 'blockquote': {
            let m: RegExpMatchArray | null;
            if (
                token.tokens[0].type === 'paragraph' &&
                // biome-ignore lint/suspicious/noAssignInExpressions: 正则表达式常规用法
                (m = /\[@(.*?)\]/g.exec(token.tokens[0].raw))
            ) {
                const summary = m[1].trim();
                return h('details', {}, [
                    ...(summary
                        ? [
                              h(
                                  'summary',
                                  (
                                      marked.lexer(summary) as (MarkedToken & {
                                          tokens: MarkedToken[];
                                      })[]
                                  )[0].tokens.map(e => renderToken(e)),
                              ),
                          ]
                        : []),
                    ...r(token.tokens.slice(1) as MarkedToken[])(),
                ]);
            }
            return h(NBlockquote, r(token.tokens as MarkedToken[]));
        }
        case 'list':
            return h(
                token.ordered ? NOl : NUl,
                r(token.items as MarkedToken[]),
            );
        case 'list_item':
            return h(NLi, r(token.tokens as MarkedToken[]));
        case 'text':
            return 'tokens' in token
                ? h(NText, r(token.tokens as MarkedToken[]))
                : decodeEntities(token.text);
        case 'link':
            return h(
                NA,
                {
                    href: token.href,
                    title: token.title && decodeEntities(token.title),
                    target: '_blank',
                },
                r(token.tokens as MarkedToken[]),
            );
        case 'del':
            return h(NText, { delete: true }, r(token.tokens as MarkedToken[]));
        case 'code':
            return h(NP, { style: { position: 'relative' } }, () => [
                h(
                    NButton,
                    {
                        quaternary: true,
                        circle: true,
                        style: {
                            position: 'absolute',
                            top: 0,
                            right: 0,
                        },
                        onClick: () =>
                            navigator.clipboard
                                .writeText(token.text)
                                .then(() =>
                                    window.chiya.message.success('已复制代码'),
                                ),
                    },
                    { icon: () => h(NMdi, { icon: mdiContentCopy }) },
                ),
                h(NCode, {
                    code: token.text,
                    language: token.lang,
                    showLineNumbers: true,
                    style: {
                        overflowY: 'auto',
                    },
                }),
            ]);
        case 'codespan':
            return h(NText, { code: true }, () => decodeEntities(token.text));
        case 'space':
            return ' ';
        case 'image':
            return h(NImage, {
                src: token.href,
                alt: token.text && decodeEntities(token.text),
                title: token.title && decodeEntities(token.title),
                imgProps: {
                    style: {
                        maxWidth: '100%',
                    },
                },
            });
        case 'table':
            return h(NTable, { style: { width: 'unset' } }, () => [
                h(NThead, () => [
                    h(NTr, () =>
                        token.header.map((e, i) =>
                            h(
                                NTh,
                                { style: { textAlign: token.align[i] } },
                                r(e.tokens as MarkedToken[]),
                            ),
                        ),
                    ),
                ]),
                h(NTbody, () =>
                    token.rows.map(e =>
                        h(NTr, () =>
                            e.map((t, i) =>
                                h(
                                    NTd,
                                    { style: { textAlign: token.align[i] } },
                                    r(t.tokens as MarkedToken[]),
                                ),
                            ),
                        ),
                    ),
                ),
            ]);
        case 'equation':
            return h(NEquation, {
                value: token.text,
                katexOptions: { displayMode: token.displayMode },
            });
        default:
            console.log(token);
            return token.raw;
    }
};

export default (props =>
    (marked.lexer(props.content) as MarkedToken[]).map(e =>
        renderToken(e),
    )) satisfies FunctionalComponent<{ content: string }>;
