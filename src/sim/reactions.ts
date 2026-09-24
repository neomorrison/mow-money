// Client reaction lines after a job. Characters may exclaim; no em dashes.
import type { Rng } from '../core/rng';
import type { JobOutcome } from '../core/types';

export type Mood = JobOutcome['mood'];

export function moodFor(q: number, expectation: number, damages: number): Mood {
  const d = q - expectation;
  if (damages >= 2) return d >= 0 ? 'unhappy' : 'angry';
  if (d >= 10) return damages ? 'happy' : 'delighted';
  if (d >= 0) return damages ? 'neutral' : 'happy';
  if (d >= -8) return 'neutral';
  if (d >= -20) return 'unhappy';
  return 'angry';
}

const GENERIC: Record<Mood, string[]> = {
  delighted: [
    'Wow! Best this lawn has looked since we moved in.',
    'Look at those lines! I might just sit out here all evening.',
    'The neighbors are going to be so jealous.',
    'That is showroom grass. You are hired for life.',
    'I keep walking outside just to look at it.',
  ],
  happy: [
    'Looks great. See you next time.',
    'Nice and tidy. Thank you!',
    'That is exactly what I wanted.',
    'Good work. The yard feels twice as big.',
    'Clean edges, no mess. I like it.',
  ],
  neutral: [
    'It is fine. A little rough around the edges.',
    'Okay. I have seen better, I have seen worse.',
    'Thanks. Maybe a bit more care next time?',
    'It will do for this week.',
  ],
  unhappy: [
    'Hmm. There are strips you missed out back.',
    'I expected better for what I am paying.',
    'This is not really what we agreed on.',
    'I had to go over the edges myself. Not great.',
  ],
  angry: [
    'What happened out there? This is a mess!',
    'I am honestly thinking about calling someone else.',
    'You call that mowing? My goat does better.',
    'I am not happy. Not happy at all.',
  ],
};

const BY_ARCHETYPE: Record<string, Partial<Record<Mood, string[]>>> = {
  retiree: {
    delighted: ['Oh my! Come in for lemonade, I insist.', 'My late husband would have loved those stripes.'],
    happy: ['Lovely job, dear. Take a cookie for the road.'],
    angry: ['Oh dear. Oh dear, oh dear. This will not do.'],
  },
  perfectionist: {
    delighted: ['I measured. 3.0 inches, edge to edge. Remarkable.'],
    happy: ['Acceptable. Genuinely acceptable.'],
    neutral: ['I counted four stray blades by the mailbox.'],
    unhappy: ['The lines drift left near the oak. I noticed. I always notice.'],
  },
  family: {
    delighted: ['The kids can actually find the soccer ball now!'],
    happy: ['You are a lifesaver. Seriously.'],
  },
  penny: {
    delighted: ['Well. That was worth every penny. Do not tell anyone I said that.'],
    unhappy: ['For this price I expected the whole lawn, not most of it.'],
  },
  hoa: {
    delighted: ['Finally, a lawn that meets the bylaws. And then some.'],
    unhappy: ['This would not pass the HOA walk-through.'],
    angry: ['I will be bringing this up at the next board meeting.'],
  },
  techie: {
    happy: ['Great, thanks. Sorry, I am on a call.'],
    delighted: ['Five stars. I am leaving a review right now.'],
  },
  gardener: {
    delighted: ['You stayed out of my beds AND nailed the edges? Marry me. Kidding.'],
    angry: ['My tulips! What did you do to my tulips?'],
  },
  eco: {
    delighted: ['Quiet, clean, and the bees are still happy. Perfect.'],
  },
  dude: {
    delighted: ['Duuude. That is some premium turf right there.'],
    happy: ['Looks rad, man. Want a soda?'],
    neutral: ['Eh, grass is grass, man.'],
  },
  veteran: {
    delighted: ['Squared away. Outstanding work.'],
    unhappy: ['Sloppy lines. We fix that next time.'],
  },
  newcouple: {
    delighted: ['Honey, come look at the lawn! It looks like a magazine!'],
  },
  executive: {
    delighted: ['Now that is a lawn worthy of the house.'],
    unhappy: ['My assistant will be in touch about the standard we expect.'],
  },
  facilities: { happy: ['Logged as complete. Thanks.'], unhappy: ['I am noting this on the contract review.'] },
  parks: { happy: ['The fields look ready for Saturday. Thanks.'] },
  greenskeeper: { delighted: ['Tour quality. I will tell the members.'], unhappy: ['That is not fairway quality.'] },
};

const DAMAGE_LINES = [
  'Did you just mow over my {thing}?',
  'Please be more careful around my {thing} next time!',
  'That {thing} was a gift!',
];

export function reactionLine(rng: Rng, opts: { mood: Mood; archetypeId: string; firstName: string; damageThing?: string; trial?: 'signed' | 'declined' }): string {
  if (opts.trial === 'signed') {
    return rng.pick([
      'You got the job. Same time next week?',
      'Sold. Put me on the schedule.',
      'Well, that settles it. You are hired.',
    ]);
  }
  if (opts.trial === 'declined') {
    return rng.pick([
      'Thanks for trying, but I do not think it is a fit.',
      'I will pass on the contract, sorry.',
      'Free was the right price for that one.',
    ]);
  }
  if (opts.damageThing && (opts.mood === 'unhappy' || opts.mood === 'angry' || rng.chance(0.5))) {
    return rng.pick(DAMAGE_LINES).replace('{thing}', opts.damageThing);
  }
  const special = BY_ARCHETYPE[opts.archetypeId]?.[opts.mood] ?? [];
  const pool = special.length && rng.chance(0.55) ? special : GENERIC[opts.mood];
  return rng.pick(pool).replace('{first}', opts.firstName);
}

export const DAMAGE_THING: Record<string, string> = {
  flowerbed: 'flower bed', gnome: 'garden gnome', sprinkler: 'sprinkler', toy: "kid's toy", fence: 'fence', other: 'stuff',
};
