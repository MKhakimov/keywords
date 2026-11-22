import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { dictionaryFromFile } from '../src/core/dictionary/loader.ts';
import { generatePuzzle } from '../src/core/puzzle/generatePuzzle.ts';
import type { Difficulty } from '../src/core/puzzle/types.ts';
import { verifyPuzzle } from '../src/core/puzzle/verifyPuzzle.ts';
import { createExport, exportFileName, parseExport, serializeExport } from '../src/storage/exchange.ts';

interface Sample {
  readonly rubric: string;
  readonly heading: string;
  readonly riddle: string;
  readonly explanation: string;
  readonly answer: string;
  readonly theme: string;
  readonly difficulty: Exclude<Difficulty, 'easy'>;
}

const SAMPLES: readonly Sample[] = [
  {
    rubric: 'Народная мудрость',
    heading: 'Что имеем — не храним, потерявши — …',
    riddle: 'Каким словом заканчивается пословица о запоздалом сожалении?',
    explanation: 'Её вспоминают, когда ценность привычного становится понятна только после утраты.',
    answer: 'плачем',
    theme: 'пословицы',
    difficulty: 'medium',
  },
  {
    rubric: 'Загадка',
    heading: 'Кино, которое показывают только вам',
    riddle: 'Что можно увидеть с закрытыми глазами, а утром долго пересказывать?',
    explanation: 'Билет не нужен, сеанс начинается каждую ночь, а сюжет почти никогда не удаётся запомнить целиком.',
    answer: 'сон',
    theme: 'загадки',
    difficulty: 'medium',
  },
  {
    rubric: 'Загадка',
    heading: 'Чем больше берёшь, тем больше становится',
    riddle: 'Из неё всё время что-то забирают, а она от этого только растёт. Что это?',
    explanation: 'Работа землекопа как раз в том, чтобы сделать её побольше.',
    answer: 'яма',
    theme: 'загадки',
    difficulty: 'medium',
  },
  {
    rubric: 'Загадка',
    heading: 'Ваше, но не для вас',
    riddle: 'Это принадлежит только вам, но другие пользуются этим гораздо чаще, чем вы сами. Что это?',
    explanation: 'Его дают при рождении, пишут в документах и окликают им на улице.',
    answer: 'имя',
    theme: 'загадки',
    difficulty: 'hard',
  },
  {
    rubric: 'Народная загадка',
    heading: 'Без рук, без ног, а ворота отворяет',
    riddle: 'Кто открывает ворота, не имея ни рук, ни ног?',
    explanation: 'Его не видно, зато хорошо слышно, как он гонит листья и свистит в трубе.',
    answer: 'ветер',
    theme: 'народные загадки',
    difficulty: 'medium',
  },
  {
    rubric: 'Народная загадка',
    heading: 'Не огонь, а жжётся',
    riddle: 'Растёт у забора, жжётся без огня, а без перчаток её лучше не трогать. Что это?',
    explanation: 'Из неё варят весенние щи, хотя собирать её — то ещё испытание.',
    answer: 'крапива',
    theme: 'растения',
    difficulty: 'medium',
  },
  {
    rubric: 'Игра слов',
    heading: 'Словарная ловушка',
    riddle: 'Какое слово в любом словаре всегда написано неверно?',
    explanation: 'Ответ спрятан в самом вопросе, если прочитать его буквально.',
    answer: 'неправильно',
    theme: 'игра слов',
    difficulty: 'hard',
  },
  {
    rubric: 'Загадка',
    heading: 'Чем больше сушит, тем сильнее мокнет',
    riddle: 'Что становится всё мокрее, чем лучше выполняет свою работу?',
    explanation: 'Висит в ванной и на кухне, а после бани без него не обойтись.',
    answer: 'полотенце',
    theme: 'быт',
    difficulty: 'medium',
  },
  {
    rubric: 'Загадка',
    heading: 'Полиглот поневоле',
    riddle: 'Кто отвечает на любом языке мира, но только вашими же словами?',
    explanation: 'Живёт в горах, лесах и пустых залах, а разговор с ним всегда немного запаздывает.',
    answer: 'эхо',
    theme: 'загадки',
    difficulty: 'hard',
  },
  {
    rubric: 'Загадка',
    heading: 'Легче пёрышка',
    riddle: 'Оно легче пёрышка, но дольше пары минут его не удержит даже силач. Что это?',
    explanation: 'Его затаивают от волнения и переводят после бега.',
    answer: 'дыхание',
    theme: 'загадки',
    difficulty: 'hard',
  },
  {
    rubric: 'Народная мудрость',
    heading: 'У семи нянек дитя без …',
    riddle: 'Какое слово пропущено в пословице о том, что многолюдный присмотр хуже одного внимательного?',
    explanation: 'Когда ответственность делят на всех, каждый надеется на другого.',
    answer: 'глазу',
    theme: 'пословицы',
    difficulty: 'medium',
  },
  {
    rubric: 'Народная мудрость',
    heading: 'Тише едешь — … будешь',
    riddle: 'Каким словом заканчивается пословица в защиту неторопливости?',
    explanation: 'Её любят повторять осторожные водители и противники спешки в любом деле.',
    answer: 'дальше',
    theme: 'пословицы',
    difficulty: 'medium',
  },
  {
    rubric: 'Игра слов',
    heading: 'Арифметика гласных',
    riddle: 'В каком слове сорок гласных?',
    explanation: 'Считать гласные по одной бесполезно — надо прочитать слово по частям. Это ещё и птица.',
    answer: 'сорока',
    theme: 'игра слов',
    difficulty: 'hard',
  },
  {
    rubric: 'Народная загадка',
    heading: 'В огне не горит, в воде не тонет',
    riddle: 'Что не горит в огне и не тонет в воде?',
    explanation: 'Зимой его хватает на каждой реке, а летом его кладут в стакан с лимонадом.',
    answer: 'лёд',
    theme: 'народные загадки',
    difficulty: 'medium',
  },
  {
    rubric: 'Классика',
    heading: 'Мой дядя самых честных …',
    riddle: 'Каким словом заканчивается первая строка романа в стихах «Евгений Онегин»?',
    explanation: 'Роман открывается раздумьями молодого героя, который едет к тяжело больному родственнику.',
    answer: 'правил',
    theme: 'литература',
    difficulty: 'hard',
  },
  {
    rubric: 'Крылатое слово',
    heading: 'Занятие для лентяя',
    riddle: 'Что, по известному выражению, бьёт бездельник?',
    explanation: 'Когда-то это были деревянные заготовки для ложек — работа настолько простая, что её считали почти безделицей.',
    answer: 'баклуши',
    theme: 'фразеологизмы',
    difficulty: 'hard',
  },
  {
    rubric: 'Крылатое слово',
    heading: 'Что точат болтуны',
    riddle: 'Что, по известному выражению, точат любители пустых разговоров?',
    explanation: 'Слово давно ушло из обихода и живёт только в этом выражении, а точильщиков меньше не становится.',
    answer: 'лясы',
    theme: 'фразеологизмы',
    difficulty: 'hard',
  },
  {
    rubric: 'Крылатое слово',
    heading: 'Куда попадает неосторожный',
    riddle: 'Куда, по известному выражению, попадает человек, оказавшийся в нелепом положении?',
    explanation: 'Когда-то так называли станок для витья верёвок, и попасть в него было по-настоящему опасно.',
    answer: 'впросак',
    theme: 'фразеологизмы',
    difficulty: 'hard',
  },
  {
    rubric: 'Народная мудрость',
    heading: 'В … черти водятся',
    riddle: 'Каких двух слов не хватает в пословице о том, что скромный вид бывает обманчив?',
    explanation: 'Так говорят о человеке, который кажется спокойным и незаметным, но способен всерьёз удивить.',
    answer: 'тихом омуте',
    theme: 'пословицы',
    difficulty: 'medium',
  },
  {
    rubric: 'Крылатое слово',
    heading: '… во лбу',
    riddle: 'Сколько и чего, по известному выражению, во лбу у очень умного человека?',
    explanation: 'Старинная мера длины — расстояние между растянутыми большим и указательным пальцами.',
    answer: 'семь пядей',
    theme: 'фразеологизмы',
    difficulty: 'hard',
  },
];

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'samples');
const ILLUSTRATIONS = resolve(ROOT, 'public/illustrations');

async function illustrationFiles(): Promise<Map<number, string>> {
  const files = new Map<number, string>();
  for (const name of await readdir(ILLUSTRATIONS)) {
    const match = /^(\d{2})-.+\.(jpe?g|png|webp)$/iu.exec(name.normalize('NFC'));
    if (match) files.set(Number(match[1]), match[0]);
  }
  return files;
}

async function main(): Promise<void> {
  const raw: unknown = JSON.parse(await readFile(resolve(ROOT, 'public/dict/ru-nouns.v1.json'), 'utf8'));
  const dictionary = dictionaryFromFile(raw, RU_ALPHABET);
  await mkdir(OUT, { recursive: true });
  const images = await illustrationFiles();

  let failures = 0;
  for (const [index, sample] of SAMPLES.entries()) {
    const now = new Date();
    const result = generatePuzzle(
      {
        id: randomUUID(),
        title: sample.heading,
        theme: sample.theme,
        difficulty: sample.difficulty,
        seed: 1000 + index,
        createdAt: now.toISOString(),
        editorial: {
          rubric: sample.rubric,
          heading: sample.heading,
          riddle: sample.riddle,
          explanation: sample.explanation,
          answer: sample.answer,
        },
        illustration: images.has(index + 1)
          ? {
              src: `/illustrations/${images.get(index + 1)}`,
              alt: `Иллюстрация к загадке «${sample.heading}»`,
              prompt: '',
              placeholder: false,
            }
          : {
              src: '/illustrations/placeholder.png',
              alt: 'Иллюстрация-заглушка: двое беседуют в комнате',
              prompt: '',
              placeholder: true,
            },
      },
      { dictionary, alphabet: RU_ALPHABET },
    );
    const number = String(index + 1).padStart(2, '0');
    if (result.status !== 'ok') {
      failures += 1;
      console.error(`${number} «${sample.answer}»: ${result.reason}`);
      continue;
    }

    const record = {
      id: result.puzzle.meta.id,
      puzzle: result.puzzle,
      progress: {},
      solved: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const text = serializeExport(createExport([record], now));

    const parsed = parseExport(text, RU_ALPHABET.id);
    const item = parsed.items[0];
    const report = item ? verifyPuzzle(item.puzzle, { dictionary, alphabet: RU_ALPHABET }) : null;
    if (parsed.rejected.length > 0 || !report?.valid) {
      failures += 1;
      console.error(`${number} «${sample.answer}»: файл не прошёл повторную проверку`);
      continue;
    }

    const fileName = `${number}-${exportFileName([record], now).replace(/^keywords-/, '').replace(/-\d{4}-\d{2}-\d{2}\.json$/, '')}.json`;
    await writeFile(resolve(OUT, fileName), text);
    const p = result.puzzle;
    console.log(
      `${number} ${sample.difficulty.padEnd(6)} ${p.answerParts.map((a) => a.text).join(' ').padEnd(12)} слов ${p.words.length}, подсказок ${p.givens.length}, картинка ${p.illustration.src} → samples/${fileName}`,
    );
  }

  if (failures > 0) {
    console.error(`Не удалось: ${failures}`);
    process.exitCode = 1;
  }
}

await main();
