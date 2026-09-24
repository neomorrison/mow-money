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
    'The edges are so crisp I could cut paper on them.',
    'Not a single clipping on the driveway. How?',
    'Look at that! Straight lines all the way to the fence.',
    "I've never seen this yard look so even.",
    'Those edges along the walk are perfect. Just perfect!',
    'The whole street is going to ask who did this.',
    'Clean lines, clean walks, clean everything. Amazing!',
    'It looks like a golf course out there!',
    'You even got the strip behind the shed. Nobody gets that strip!',
    "I'm taking pictures. This is going on the fridge.",
  ],
  happy: [
    'Looks great. See you next time.',
    'Nice and tidy. Thank you!',
    'That is exactly what I wanted.',
    'Good work. The yard feels twice as big.',
    'Clean edges, no mess. I like it.',
    'Nice even cut. Thanks.',
    'Walks are clean and the edges look sharp. Good job.',
    'Looks good out there. Right on schedule too.',
    'The yard looks neat again. Thank you!',
    'Nice job around the flower beds.',
    "Lines look straight. I'm happy.",
    "Good cut. Driveway's clean too. Appreciate it.",
    "That's a solid job. Same time next week.",
    'The lawn looks healthy and tidy. Thanks!',
    'Much better. I can see the sidewalk again.',
  ],
  neutral: [
    'It is fine. A little rough around the edges.',
    'Okay. I have seen better, I have seen worse.',
    'Thanks. Maybe a bit more care next time?',
    'It will do for this week.',
    "It's okay. A few clippings on the driveway.",
    "The edges are a bit ragged, but it's cut.",
    "Some of the lines wander. It's fine, I guess.",
    "It's mowed. That's about all I can say.",
    'Not bad. You missed a little by the mailbox.',
    "It's alright. The corners could be cleaner.",
    'Fine. Uneven in a couple of spots, but fine.',
    "Okay. I'll sweep the walk myself.",
    "It's short now, anyway.",
    'Passable. The back looks better than the front.',
  ],
  unhappy: [
    'Hmm. There are strips you missed out back.',
    'I expected better for what I am paying.',
    'This is not really what we agreed on.',
    'I had to go over the edges myself. Not great.',
    "There's a whole strip by the fence you skipped.",
    'Clippings all over the driveway. Really?',
    'The edges are a mess. It looks half done.',
    'Why are there clumps of grass everywhere?',
    'The lines are all over the place.',
    'You missed the side yard entirely.',
    'There are tufts sticking up all over the back.',
    'It looks patchy. Some spots are way shorter than others.',
    'The walk is covered in grass. I just swept it.',
    'I can see where you stopped and started. Not great.',
  ],
  angry: [
    'What happened out there? This is a mess!',
    'I am honestly thinking about calling someone else.',
    'You call that mowing? My goat does better.',
    'I am not happy. Not happy at all.',
    'Half the lawn is still standing! Did you even finish?',
    "There's grass all over my driveway, my walk and my car!",
    "You scalped it! It's brown in patches!",
    'This is worse than before you came.',
    "Those aren't stripes, they're scribbles!",
    'The edges look chewed. Chewed!',
    'I want a redo or a refund. Preferably both.',
    'The neighbors are laughing at my lawn. Laughing!',
    "Don't bother coming back if it looks like this.",
    'Did a mower even touch the backyard?',
  ],
};

const BY_ARCHETYPE: Record<string, Partial<Record<Mood, string[]>>> = {
  retiree: {
    delighted: [
      'Oh my! Come in for lemonade, I insist.',
      'My late husband would have loved those stripes.',
      "Oh, it's beautiful! I'm calling my daughter right now to tell her.",
      'Look at that! The bridge club will be green with envy.',
    ],
    happy: [
      'Lovely job, dear. Take a cookie for the road.',
      'Oh, very nice, dear. Just like the old days.',
      'Thank you, sweetie. It looks so tidy now.',
      'Lovely. I can see my flower pots again!',
    ],
    neutral: [
      "Oh, it's alright, dear. A little uneven, but alright.",
      "Well, it's shorter. That's something.",
      "Hmm, some clippings on the walk. I'll get the broom.",
      "It's fine, sweetie. Maybe a bit neater next time?",
    ],
    unhappy: [
      'Oh dear. You missed a strip by the birdbath.',
      "Sweetie, there's grass all over my porch steps.",
      'Hmm. The edges used to be straighter, dear.',
      "Oh, that's a bit messy, dear. I'm a little disappointed.",
    ],
    angry: [
      'Oh dear. Oh dear, oh dear. This will not do.',
      'Goodness! What happened to my lovely lawn?',
      "I'm very upset, young one. Very upset.",
      "Oh my. I'll have to call my son about this.",
    ],
  },
  perfectionist: {
    delighted: [
      'I measured. 3.0 inches, edge to edge. Remarkable.',
      'Stripes at 22 inches. Every one. I checked with a tape.',
      "Zero clippings on the hardscape. I'm almost emotional.",
      'The edges are a true 90 degrees. Remarkable work.',
    ],
    happy: [
      'Acceptable. Genuinely acceptable.',
      'Good. The lines are within a quarter inch.',
      'Satisfactory. I only found one clipping.',
      "The edges are clean. I've made a note. A good note.",
    ],
    neutral: [
      'I counted four stray blades by the mailbox.',
      'Height varies by half an inch in the back. Noted.',
      'Adequate. The corners need attention.',
      'The stripes drift at the end. Slightly. I saw it.',
    ],
    unhappy: [
      'The lines drift left near the oak. I noticed. I always notice.',
      "There's a two-inch strip by the fence. I measured it.",
      'I found clippings in the gutter. Seven of them.',
      "The edge along the walk wobbles. It's not a straight line.",
    ],
    angry: [
      'This is not three inches. This is chaos.',
      "I have photographed every error. It's a long album.",
      'The lines cross. They cross! Stripes do not cross!',
      'Unacceptable. I will be re-mowing this myself.',
    ],
  },
  family: {
    delighted: [
      'The kids can actually find the soccer ball now!',
      "Wow! It looks like a real park! The kids are already out there!",
      'No more lost shoes! Okay, fewer lost shoes. It looks amazing!',
      'You even mowed around the fort. The kids say thank you!',
    ],
    happy: [
      'You are a lifesaver. Seriously.',
      'Looks great! And you picked up the toys? Bless you.',
      'Nice! The kids can play out there again.',
      'Thank you so much. One less thing this week.',
    ],
    neutral: [
      "It's fine. Honestly, I'm just glad it's shorter.",
      'Okay, thanks. A few clippings, but the kids track in worse.',
      "It's alright. Kind of uneven by the swing set.",
      'Fine. Nobody will notice with all the toys anyway.',
    ],
    unhappy: [
      'You missed the whole side by the trampoline.',
      "There's grass all over the kids' chalk drawings.",
      'Hmm, the backyard still looks pretty long.',
      "The kids found a big tall patch. They're calling it the jungle.",
    ],
    angry: [
      'The kids are covered in clippings! What happened?',
      'Half the yard is still tall! We lost the dog again!',
      "I don't have time to fix this. That was the whole point!",
      'This is a mess, and I already have three kids making messes.',
    ],
  },
  penny: {
    delighted: [
      'Well. That was worth every penny. Do not tell anyone I said that.',
      "Hmph. That's actually worth the money. Don't raise your price.",
      "Clean edges and no mess. I'm almost happy to pay.",
      "Well, well. Best money I've spent this year. Low bar, but still.",
    ],
    happy: [
      'Fine. Looks good. Not tipping, but it looks good.',
      "It's cut. Edges done. Money well spent. Barely.",
      'Good. No extra charges, right?',
      "Alright. That'll do. Same price next time.",
    ],
    neutral: [
      "It's okay. For what I'm paying, I guess it's okay.",
      "Meh. I've seen better from the neighbor kid.",
      "It's cut. Some clippings on my walk, though.",
      'Fine. I expect better edges next time. Same price.',
    ],
    unhappy: [
      'For this price I expected the whole lawn, not most of it.',
      'You missed a strip. I want a discount.',
      "Clippings on the driveway? I'm not paying for sweeping.",
      "That's not a full mow. That's a partial mow. Partial pay.",
    ],
    angry: [
      'This is a rip off! I want my money back!',
      'Half the lawn? Then half the money!',
      "I've seen better mowing from a goat. And goats work for free.",
      "Don't expect me to pay for this mess.",
    ],
  },
  hoa: {
    delighted: [
      'Finally, a lawn that meets the bylaws. And then some.',
      'This lawn is the new standard for the subdivision.',
      'Edges at two inches. Exactly per the bylaws. Outstanding.',
      "I'll be nominating this yard for Lawn of the Month.",
    ],
    happy: [
      'Compliant. Well done.',
      "This passes inspection. I'm pleased.",
      'Clean edges. The board will approve.',
      'Good. No violations to report.',
    ],
    neutral: [
      'Acceptable. Barely compliant.',
      "I'll let the clippings on the walk slide. This time.",
      'It meets the minimum standard. The minimum.',
      'Adequate. The corner by the mailbox needs attention.',
    ],
    unhappy: [
      'This would not pass the HOA walk-through.',
      'The edges exceed the two-inch guideline. I measured.',
      'Clippings on the sidewalk are a citation, you know.',
      "There's an unmowed strip visible from the street. Unacceptable.",
    ],
    angry: [
      'I will be bringing this up at the next board meeting.',
      'This is a violation. Possibly several.',
      "I'm writing myself a citation because of you.",
      'The entire board will hear about this. In detail.',
    ],
  },
  techie: {
    delighted: [
      'Five stars. I am leaving a review right now.',
      "Wow, this looks amazing. I'm posting it to the neighborhood app.",
      'Crushed it. The lawn is finally out of the backlog.',
      'Looks incredible. Ten out of ten, would renew.',
    ],
    happy: [
      'Great, thanks. Sorry, I am on a call.',
      'Looks good. Thanks! Autopay is set.',
      'Nice. Clean, fast, done. Love it.',
      "Great work. Oops, I'm unmuted. Thanks!",
    ],
    neutral: [
      "Looks fine. Can't really tell from the window.",
      "Okay, thanks. There's grass on the walk, but okay.",
      "It's done. That's what matters. Mostly.",
      'Solid enough. A few edge cases by the fence. Literally.',
    ],
    unhappy: [
      "Hmm, there's a missed strip out back. Can you patch that?",
      'The edges look buggy. Can we fix that next sprint?',
      'Clippings all over the driveway. Not ideal.',
      'I expected better. Filing this as a regression.',
    ],
    angry: [
      'This is broken. The whole back is still tall.',
      "I'm escalating this. To myself. I'm very upset.",
      "One star. I'm writing the review right now.",
      'This is a total fail. What happened out there?',
    ],
  },
  gardener: {
    delighted: [
      'You stayed out of my beds AND nailed the edges? Marry me. Kidding.',
      'The beds are untouched and the edges are perfect! Oh, bless you.',
      'Not a single clipping in my mulch! I could cry.',
      'The lawn frames the roses beautifully now. Thank you!',
    ],
    happy: [
      'Lovely. You were careful around the beds.',
      'Nice clean edges along the borders. Thank you, dear.',
      "Looks good. The hostas are safe. That's what matters.",
      'Tidy and even. The garden looks happier.',
    ],
    neutral: [
      "It's alright. Some clippings got into the mulch.",
      'Fine. The border edge is a bit wobbly.',
      "It's cut. Please be gentler near the daylilies.",
      "Okay. The lawn's fine. The beds are a little dusty.",
    ],
    unhappy: [
      'There are clippings all over my zinnias.',
      'You got a little close to the peonies, dear.',
      "The edges bite into my border. That's not right.",
      'Hmm. Grass in the vegetable patch. Not good.',
    ],
    angry: [
      'My tulips! What did you do to my tulips?',
      "You mowed right through the lavender! I'm heartbroken!",
      'My border! My beautiful border!',
      'Clippings in every bed! Every single one!',
    ],
  },
  eco: {
    delighted: [
      'Quiet, clean, and the bees are still happy. Perfect.',
      'You left the clover patch! The bees are thrilled. So am I!',
      'No fumes, clean cut, happy bees. This is the dream.',
      'Beautiful! And you mulched the clippings back in. Perfect.',
    ],
    happy: [
      'Nice job! The pollinator strip looks great.',
      'Looks good, and it was so quiet. Thank you!',
      'Great cut. The yard feels balanced.',
      'Lovely. Good for the lawn, good for the bees.',
    ],
    neutral: [
      "It's fine. Maybe leave it a little longer next time?",
      'Okay. You got close to the wildflowers, but okay.',
      "It's alright. Some clippings on the walk.",
      'Fine. The bees seem okay with it.',
    ],
    unhappy: [
      'You cut the clover really short. The bees are confused.',
      'There are clippings in the rain barrel. Please be careful.',
      "It's pretty scalped in spots. That stresses the soil.",
      'Hmm. You mowed the pollinator strip. We talked about that.',
    ],
    angry: [
      'You mowed down the whole wildflower patch! The bees!',
      'Clippings in the storm drain! That goes to the creek!',
      'This is not eco friendly. This is eco hostile!',
      'My bee lawn is gone. Just gone!',
    ],
  },
  landlord: {
    delighted: [
      'Looks great. I might raise the rent. Kidding. Mostly.',
      'Best this rental has ever looked. Keep it up.',
      'Sharp. The listing photos will look great.',
      'The city inspector will have nothing to say. Excellent.',
    ],
    happy: [
      'Good. Keeps the city off my back.',
      'Looks fine. Send the invoice.',
      "Tidy. That's what I pay for.",
      "Good work. Tenants won't complain now.",
    ],
    neutral: [
      "It's cut. Good enough for a rental.",
      'Fine. Clippings on the walk, but fine.',
      'Okay. As long as it passes code.',
      "It'll do. Just don't miss next time.",
    ],
    unhappy: [
      "The tenant sent me a picture. There's a strip you missed.",
      'Clippings all over the driveway. The tenants called me.',
      "That's sloppy. I pay for a full job.",
      'The side yard is still long. The city will notice.',
    ],
    angry: [
      'The tenants are complaining. That never happens. Fix it.',
      'I got a call from code enforcement. Again!',
      "You're costing me money. That's not the deal.",
      "This is lousy work. I'm finding someone else.",
    ],
  },
  dude: {
    delighted: [
      'Duuude. That is some premium turf right there.',
      'Whoa. I can see the hammock again! Epic!',
      'Those stripes are gnarly, man. In a good way!',
      'Dude! My lawn has never looked this rad.',
    ],
    happy: [
      'Looks rad, man. Want a soda?',
      'Nice, dude. Clean and chill.',
      'Looks sweet, man. Thanks.',
      'Rad work, dude. Here, grab a popsicle.',
    ],
    neutral: [
      'Eh, grass is grass, man.',
      "It's cool, man. Short grass, long grass. It's all good.",
      'Looks okay, dude. Kinda lumpy but whatever.',
      "Eh, it's mowed. That's the vibe.",
    ],
    unhappy: [
      'Dude, you missed a big patch by the hammock.',
      "Uh, man, there's grass all over my surfboard.",
      'Kinda patchy, dude. Not super rad.',
      "Bro, even I noticed the missed strip. And I don't notice stuff.",
    ],
    angry: [
      'Dude! Not cool! The yard looks like a bad haircut!',
      'Whoa, harsh. This is a mess, man.',
      'Not chill, dude. Not chill at all.',
      "Bro. I'm not even mad. Okay, I'm a little mad.",
    ],
  },
  veteran: {
    delighted: [
      'Squared away. Outstanding work.',
      'Lines like a parade ground. Well done.',
      'Edges sharp enough to shave with. Outstanding.',
      "Textbook. That's how it's done.",
    ],
    happy: [
      'Good work. Carry on.',
      'Clean lines. Clean edges. Good.',
      'Satisfactory. See you next week.',
      'Solid job. Keep it up.',
    ],
    neutral: [
      'Acceptable. Tighten up the edges.',
      "It'll pass. Barely.",
      'Adequate. Watch your lines by the flagpole.',
      'Fine. Room for improvement.',
    ],
    unhappy: [
      'Sloppy lines. We fix that next time.',
      'Missed a strip by the fence. Unacceptable.',
      'Clippings on the walk. Police your area.',
      "That's not up to standard. Do better.",
    ],
    angry: [
      'This is a disgrace. Fix it.',
      "I've seen better work from raw recruits.",
      "That lawn wouldn't pass any inspection I ever ran.",
      "Unacceptable. Don't come back until you can do it right.",
    ],
  },
  newcouple: {
    delighted: [
      'Honey, come look at the lawn! It looks like a magazine!',
      'It looks like a real house now! Like grown-ups live here!',
      'Stripes! We have stripes! Honey, we have stripes!',
      "We're taking pictures for our parents. It looks so good!",
    ],
    happy: [
      'Oh, it looks so nice! Thank you!',
      'Yay! Our lawn looks like a lawn!',
      'Great job! The neighbors are going to like us now.',
      "Thank you! We'd never have done this ourselves.",
    ],
    neutral: [
      "Oh, it's good! We think? Is it good?",
      'It looks okay! A few clippings on the walk, but okay.',
      "It's nice! Kind of uneven by the porch, maybe?",
      'Okay! Better than we could do, for sure.',
    ],
    unhappy: [
      "Oh. There's a strip you missed. We're pretty sure.",
      "Um, there's grass all over our new doormat.",
      'It looks a little patchy. Is that normal?',
      "We're a little disappointed. The neighbors' lawn looks better.",
    ],
    angry: [
      'What happened? Our lawn looks worse than before!',
      'We just bought this house! Now the yard looks awful!',
      "Honey, come look at this. No, it's bad. Really bad.",
      "We're really upset. This was our first lawn!",
    ],
  },
  executive: {
    delighted: [
      'Now that is a lawn worthy of the house.',
      'Impeccable. The guests will notice.',
      'Stripes, edges, detail. Exactly what I pay for.',
      'This is the standard. Maintain it.',
    ],
    happy: [
      'Good. That will do nicely.',
      'Satisfactory. My assistant will process payment.',
      'Clean work. I noticed.',
      'Fine work. The estate looks proper again.',
    ],
    neutral: [
      'Adequate. I expect more than adequate.',
      'The edges are soft. Sharpen them next time.',
      'Passable. Barely.',
      "It's acceptable. My standards are not merely acceptable.",
    ],
    unhappy: [
      'My assistant will be in touch about the standard we expect.',
      "The stripes are uneven. That's visible from the drive.",
      'Clippings on the terrace. Unacceptable.',
      'This is not what the estate requires.',
    ],
    angry: [
      'This is an embarrassment. Guests arrive tomorrow.',
      "I've dismissed crews for less. Much less.",
      "Clean this up or don't come back.",
      'This lawn is an insult to the house.',
    ],
  },
  facilities: {
    delighted: [
      "Best the campus has looked all year. I'm putting that in the report.",
      'Excellent. Zero complaints in the ticket queue.',
      "Great work. I'm recommending a contract extension.",
    ],
    happy: [
      'Logged as complete. Thanks.',
      'Looks good. Nobody filed a ticket.',
      'Clean job. Invoice when ready.',
    ],
    neutral: [
      'Meets spec. Mostly.',
      "It's fine. A couple of edges need follow up.",
      "Acceptable. I'll note it as complete.",
    ],
    unhappy: [
      'I am noting this on the contract review.',
      'Grass on the walkways. We got two complaints.',
      'The strip by the parking lot was missed. Please fix.',
    ],
    angry: [
      "The CEO noticed. That's never good.",
      'This is a contract issue now.',
      "I've got a stack of complaints on my desk. About your work.",
    ],
  },
  parks: {
    delighted: [
      'The fields look amazing! The kids are going to love it.',
      'Best the park has looked in years. Thank you!',
      'Those baselines are crisp. The umpires will be thrilled.',
    ],
    happy: [
      'The fields look ready for Saturday. Thanks.',
      'Looks great. The picnic area is clean too.',
      'Good job. Nice even cut on the soccer fields.',
    ],
    neutral: [
      "It's fine. A few clippings on the paths.",
      'Okay. The outfield is a bit uneven.',
      "It'll do for this week.",
    ],
    unhappy: [
      'The ball fields have missed strips. The coaches noticed.',
      "Clippings all over the playground. That's a problem.",
      'The dog park is still tall. People are asking.',
    ],
    angry: [
      "I've got angry parents calling. Lots of them.",
      'The tournament is Saturday and the fields look like this?',
      'The council is going to hear about this. From me.',
    ],
  },
  greenskeeper: {
    delighted: [
      'Tour quality. I will tell the members.',
      'Those fairway lines are perfect. Like a tournament broadcast.',
      "Not a blade out of place. I'm impressed. Don't tell anyone.",
    ],
    happy: [
      'Good cut. Clean collar edges.',
      "Solid work. The members won't complain.",
      'Acceptable. Keep the reels sharp.',
    ],
    neutral: [
      'Fine. The rough is a little uneven.',
      "It'll hold. Watch the approach cut.",
      'Passable. Not tour quality.',
    ],
    unhappy: [
      'That is not fairway quality.',
      "Clippings on the green. You can't leave clippings on the green.",
      'The lines on eleven are crooked. Members will talk.',
    ],
    angry: [
      'You scalped the collar on seven. Do you know what that costs?',
      'This is a public course standard. We are not a public course.',
      'The members are furious. So am I.',
    ],
  },
};

const DAMAGE_LINES = [
  'Did you just mow over my {thing}?',
  'Please be more careful around my {thing} next time!',
  'That {thing} was a gift!',
  'Hey! My {thing}! What happened?',
  'Is that my {thing}? Oh no.',
  'You got my {thing}. I saw it from the window.',
  'Watch out for my {thing}! Too late, I guess.',
  'My {thing} is ruined! Ruined!',
  "Who's paying for my {thing}?",
  'I told you about the {thing}. I am sure I did.',
  'Oh, come on. Not my {thing}!',
  'Next time, please mow around my {thing}. Around.',
];

/** Said when a free trial mow wins the contract. */
export const TRIAL_SIGNED: string[] = [
  'You got the job. Same time next week?',
  'Sold. Put me on the schedule.',
  'Well, that settles it. You are hired.',
  "Alright, you've earned it. Let's make it regular.",
  'That looks great. Sign me up.',
  "Okay, I'm convinced. When's the next mow?",
  'Consider yourself hired.',
  'You passed. Welcome aboard.',
  "Yep, that'll do. Let's keep this going.",
];

/** Said when a free trial mow does not win the contract. */
export const TRIAL_DECLINED: string[] = [
  'Thanks for trying, but I do not think it is a fit.',
  'I will pass on the contract, sorry.',
  'Free was the right price for that one.',
  "Thanks, but I think I'll keep looking.",
  "It's not quite what I wanted. No contract, sorry.",
  "I appreciate the free mow, but I'll pass.",
  'Not bad, but not enough to sign. Thanks.',
  "I think I'll go back to doing it myself.",
  "Thanks for the trial. I'm going to shop around.",
];

/** Said when the lawn has beautiful stripes. */
export const STRIPE_PRAISE: string[] = [
  'Those stripes! It looks like a ballpark out there!',
  'Look at those stripes! I feel like I should charge admission.',
  'The stripes are gorgeous. Light, dark, light, dark. Perfect.',
  "I've always wanted stripes like that!",
  'Those lines are so straight. It looks like a stadium.',
  'Stripes! Real stripes! The neighbors will be so jealous.',
  'It looks like the outfield on opening day.',
  'I could stare at those stripes all day.',
  "How do you get the stripes so even? It's like magic.",
  'Those stripes run straight as a ruler. Beautiful!',
  'The stripes make the whole yard look bigger.',
  "I'm taking a picture of those stripes for my phone background.",
  "My lawn has stripes. I never thought I'd say that!",
  "That's golf course striping. On my lawn!",
];

export function reactionLine(rng: Rng, opts: { mood: Mood; archetypeId: string; firstName: string; damageThing?: string; trial?: 'signed' | 'declined'; stripes?: boolean }): string {
  if (opts.trial === 'signed') {
    return rng.pick(TRIAL_SIGNED);
  }
  if (opts.trial === 'declined') {
    return rng.pick(TRIAL_DECLINED);
  }
  if (opts.damageThing && (opts.mood === 'unhappy' || opts.mood === 'angry' || rng.chance(0.5))) {
    return rng.pick(DAMAGE_LINES).replace('{thing}', opts.damageThing);
  }
  if (opts.stripes && !opts.damageThing && (opts.mood === 'delighted' || opts.mood === 'happy') && rng.chance(0.5)) {
    return rng.pick(STRIPE_PRAISE);
  }
  const special = BY_ARCHETYPE[opts.archetypeId]?.[opts.mood] ?? [];
  const pool = special.length && rng.chance(0.55) ? special : GENERIC[opts.mood];
  return rng.pick(pool).replace('{first}', opts.firstName);
}

export const DAMAGE_THING: Record<string, string> = {
  flowerbed: 'flower bed', gnome: 'garden gnome', sprinkler: 'sprinkler', toy: "kid's toy", fence: 'fence', other: 'stuff',
};
