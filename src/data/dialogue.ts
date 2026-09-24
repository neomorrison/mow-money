// Dialogue bank for door-to-door pitches. OWNED BY THE PITCH BUILDER.
// Pure data (no DOM): the negotiation engine picks lines deterministically from its seed.
//
// Placeholders: {name} homeowner first name, {price} a money amount, {company} the player's company,
// {street} the street name, {rival} the rival company name, {grass} the grass height.
// Character lines may be warm, grumpy or silly and may use exclamation marks. Never em dashes.

export type PointId = 'overgrown' | 'social_proof' | 'reputation' | 'free_trial' | 'eco' | 'beat_current';
export type ToneReaction = 'liked' | 'neutral' | 'disliked';

export interface LineSet {
  greet: string[];
  tone: { liked: string[]; neutral: string[]; disliked: string[] };
  point: Partial<Record<PointId, { works?: string[]; fails?: string[] }>>;
  pointMeh: string[];
  offended: string[];
  steep: string[];
  close: string[];
  counter: string[];
  finalCounter: string[];
  accept: string[];
  trial: string[];
  think: string[];
  walkAway: string[];
  slam: string[];
}

// ---------------------------------------------------------------- generic fallback
export const GENERIC: LineSet = {
  greet: [
    "Hello? Can I help you?",
    "Oh. Hi there. What's this about?",
    "Yes? I've got about two minutes.",
    "Hi! Sorry, the dog was going nuts. What can I do for you?",
  ],
  tone: {
    liked: [
      "Ha! Okay, you have my attention.",
      "Well, aren't you pleasant. Go on.",
      "I like that. Keep talking.",
    ],
    neutral: [
      "Mm-hm. Go on.",
      "Okay. I'm listening.",
      "Alright, what's the offer?",
    ],
    disliked: [
      "Hm. Not really my style, but go ahead.",
      "That's a bit much. What are you selling?",
      "Okay... I'm listening. Barely.",
    ],
  },
  point: {
    overgrown: {
      works: [
        "Yeah, it's gotten away from me. I'll admit it.",
        "It does look like a hayfield, doesn't it?",
        "I keep meaning to get to it. I keep not getting to it.",
      ],
      fails: [
        "Excuse me? I mowed that three days ago.",
        "My lawn is fine, thank you very much.",
        "Are you sure you're looking at the right house?",
      ],
    },
    social_proof: {
      works: [
        "Oh, you do the place down the street? It does look sharp.",
        "I did notice the lines on that lawn. That was you?",
        "Huh. If the neighbors trust you, that counts for something.",
      ],
    },
    reputation: {
      works: [
        "Good reviews, huh? That helps.",
        "I did see your name come up in the neighborhood group.",
      ],
      fails: [
        "I've heard mixed things, to be honest.",
        "Stars aren't everything. Some of those reviews were rough.",
      ],
    },
    free_trial: {
      works: [
        "Free first mow? Well, that's hard to argue with.",
        "Try before I buy. I like that.",
        "So if I don't like it, I don't pay? Okay then.",
      ],
    },
    eco: {
      works: [
        "No gas fumes? Now that's interesting.",
        "Quiet mower, huh? My ears thank you.",
      ],
      fails: [
        "I don't really care what it runs on, as long as it's cut.",
      ],
    },
    beat_current: {
      works: [
        "Honestly, {rival} has been sloppy lately.",
        "They did leave a strip by the fence last week. Every week.",
      ],
      fails: [
        "{rival} is pretty good, actually. You'd have to beat that.",
        "I've got no complaints about {rival}.",
      ],
    },
  },
  pointMeh: [
    "Okay. Sure.",
    "Mm. Noted.",
    "I suppose so.",
    "Right. And?",
  ],
  offended: [
    "Are you out of your mind? For a lawn?",
    "Wow. No. Absolutely not.",
    "That's more than my car payment!",
    "I'm going to pretend you didn't say that.",
  ],
  steep: [
    "That's a lot more than I had in mind.",
    "Oof. That's steep.",
    "Too rich for my blood.",
    "I was thinking a good bit lower.",
  ],
  close: [
    "Hmm. That's close. Not quite.",
    "You're in the neighborhood. Literally.",
    "Almost there. Can you do a little better?",
    "That's not crazy. But no.",
  ],
  counter: [
    "How about {price}?",
    "I could do {price}.",
    "Would you take {price}?",
    "Tell you what, {price} and we have a deal.",
  ],
  finalCounter: [
    "{price}. That's my final offer.",
    "Last try: {price}. Take it or leave it.",
    "I'll go to {price}, and that's it.",
  ],
  accept: [
    "You know what? Deal.",
    "Alright, you've got yourself a client.",
    "Sure, let's do it. When can you start?",
    "Deal. Don't make me regret it.",
  ],
  trial: [
    "A free first mow? Fine. Impress me.",
    "Okay, show me what you've got. If it looks good, you're hired.",
    "Deal on the trial. I'll be watching from the window.",
  ],
  think: [
    "Let me think about it, okay?",
    "I'll have to talk it over. Maybe next week.",
    "I need to sleep on it. Thanks for stopping by.",
  ],
  walkAway: [
    "Oh. Okay then. Bye.",
    "Suit yourself.",
    "Alright. Have a good one.",
  ],
  slam: [
    "We're done here.",
    "Goodbye.",
    "Please get off my porch.",
  ],
};

// ---------------------------------------------------------------- per archetype
export const ARCHETYPE_LINES: Record<string, Partial<LineSet>> = {
  retiree: {
    greet: [
      "Well hello there, young one! Come in out of the sun. Actually, stay there, the cat gets out.",
      "Oh! I thought you were the mailman. You're much taller.",
      "Hello, dear. Are you selling cookies? I do love those mint ones.",
      "Hi there! I'm {name}. I've lived on {street} since before the stop sign.",
    ],
    tone: {
      liked: [
        "Oh, you're a sweetheart. Your mother raised you right.",
        "Ha! You remind me of my grandson. He's a dentist now.",
        "Well aren't you a ray of sunshine.",
      ],
      neutral: [
        "Mm-hm. Go on, dear.",
        "Alright, I'm listening. My hearing aid is in.",
      ],
      disliked: [
        "My, you're in a hurry. Nobody says hello anymore.",
        "Slow down, sweetie. I'm not going anywhere, but you might be.",
      ],
    },
    point: {
      overgrown: {
        works: ["My knees just can't push that old mower anymore. Harold used to do it.", "I know, I know. The Hendersons have been giving me looks."],
        fails: ["Oh, my nephew was just here Sunday. It looks fine to me, dear."],
      },
      social_proof: { works: ["You do Margaret's lawn? Well, if it's good enough for Margaret."] },
      reputation: { works: ["All those stars! My goodness. Like a fancy hotel."], fails: ["Oh, I don't know about that internet business. People say anything."] },
      free_trial: { works: ["Free? Oh, you don't have to do that. But I won't stop you."] },
      eco: { works: ["One of those quiet ones? Good, my afternoon nap is sacred."] },
    },
    steep: ["Oh my. I'm on a fixed income, dear.", "Goodness, that's more than my cable bill."],
    close: ["Hmm, that's almost right. My late husband would have haggled you down a bit."],
    counter: ["Would you do it for {price}? I'll throw in lemonade.", "How about {price}, and I'll make you a sandwich?", "Could you do {price}, sweetie?"],
    finalCounter: ["{price}, and that's as high as I go. Social Security only stretches so far."],
    accept: ["Wonderful! Oh, Harold would be so relieved.", "Deal! Come by anytime. I'll have lemonade.", "Oh, how lovely. I'll tell the whole bridge club."],
    trial: ["A free mow? Aren't you kind. Let's see how you do, then."],
    think: ["Let me call my daughter about it, dear. She handles the money now."],
    walkAway: ["Oh. Well, take a cookie for the road at least."],
    slam: ["Well! I never. Good day to you."],
  },

  perfectionist: {
    greet: [
      "Yes. Wipe your feet before you step on the welcome mat. It's new.",
      "Hello. Before you say anything: I cut my grass at exactly three inches.",
      "Can I help you? You're standing on my edging.",
      "Hi. I'm {name}. Please don't touch the railing, I just stained it.",
    ],
    tone: {
      liked: ["Finally, someone who speaks like a professional.", "Good. Clear and concise. I respect that."],
      neutral: ["Fine. Continue.", "Go on. Precisely, please."],
      disliked: ["This is a business conversation, not a comedy club.", "Jokes don't cut grass evenly."],
    },
    point: {
      overgrown: {
        works: ["{grass}. I measured. I have been too busy to correct it, and it haunts me."],
        fails: ["Overgrown? It is {grass}. I measured it this morning. With calipers."],
      },
      social_proof: { works: ["I have seen that lawn. The stripes were... acceptable. Actually quite good."] },
      reputation: { works: ["Consistent five-star work is the only kind that matters."], fails: ["Those reviews mention missed edges. I do not tolerate missed edges."] },
      free_trial: { works: ["An audition. Good. Everyone should have to audition."] },
      eco: { works: ["Reel mowers give a cleaner cut. That's just physics."], fails: ["I don't care about the engine. I care about the cut."] },
      beat_current: { works: ["{rival} missed two strips by the fence last week. Two. I counted."], fails: ["{rival} is precise. You would need to be more precise."] },
    },
    offended: ["That number is an insult to arithmetic.", "No. That is not a real price."],
    steep: ["Quality has a price, but not that price.", "That is roughly 30 percent over market. I checked."],
    close: ["Close. I'd round down, if I were you.", "That's within tolerance. Not within budget."],
    counter: ["{price}. I've done the math.", "I'd pay {price}. Per mow. Weekly.", "My spreadsheet says {price}."],
    finalCounter: ["{price}. That figure is final."],
    accept: ["Acceptable. The stripes run north to south. Do not deviate.", "Agreed. I will be inspecting.", "Fine. Deal. I'll email you a diagram."],
    trial: ["A trial. Good. I will grade it on a 100-point scale."],
    think: ["I need to review competing quotes. I'll be in touch.", "Let me cross-reference this. I'll decide by Friday."],
    walkAway: ["Hm. I expected more persistence."],
    slam: ["We are finished. Please step off the edging."],
  },

  family: {
    greet: [
      "Hi! Sorry, sorry, JACOB PUT THAT DOWN. Hi. What's up?",
      "Hey! Is this about the soccer carpool? No? Okay, what's up?",
      "Hi, sorry, I'm on hold with the pediatrician. You have one minute.",
      "Oh thank goodness, an adult. Hi! I'm {name}.",
    ],
    tone: {
      liked: ["Ha! Okay, I needed that today.", "You're fun. My kids would love you.", "Straight to the point. Bless you."],
      neutral: ["Okay, okay. Go.", "Sure, what are we talking about?"],
      disliked: ["I'm sorry, is this a sales pitch? I have a toddler in the bathtub."],
    },
    point: {
      overgrown: { works: ["We lost a toddler in there last week. Just for a minute.", "Yeah, the mower's been broken since... March?"], fails: ["My husband JUST did it. Barely, but he did."] },
      social_proof: { works: ["The Parkers use you? Their lawn is gorgeous. I'm jealous every morning."] },
      reputation: { works: ["Good reviews? Okay, that's one less thing to research."] },
      free_trial: { works: ["Free? Honestly, anything that's free and not a sticker, yes."] },
      eco: { works: ["Quiet is good. The baby naps at two."] },
      beat_current: { works: ["{rival} keeps running over the kids' toys. Keeps. Running. Over."] },
    },
    steep: ["Oof, with daycare? That's a stretch.", "We have three kids. Three. That's a lot."],
    close: ["That's close. Can you shave a little off? Diapers are expensive."],
    counter: ["Could you do {price}? That's what fits the budget.", "{price} and you've saved my marriage.", "How about {price}? Please say yes."],
    finalCounter: ["{price}. I literally can't go higher, we have braces coming up."],
    accept: ["YES. Oh thank you. One less thing!", "Deal! Kids, the lawn guy is here! Wait, don't come out.", "Done. You're a lifesaver."],
    trial: ["Free first mow? Yes. Please. Go. Now if you can."],
    think: ["Let me talk to my wife. She does the budget spreadsheet.", "Can I think about it? I can't think about anything right now."],
    walkAway: ["Okay, bye! EMMA, PUT THE CAT DOWN."],
    slam: ["Sorry, I can't do this right now."],
  },

  penny: {
    greet: [
      "Whatever it is, I'm not buying.",
      "If you're selling magazines, I already have one.",
      "Yes? Make it quick, the door's letting the cold air out.",
      "Hmph. The last kid charged me eight dollars and missed a spot.",
    ],
    tone: {
      liked: ["Good. No fluff. Fluff costs money.", "Direct. I like direct. Direct is cheap."],
      neutral: ["Mm. Keep going.", "I'm listening. For free, I assume."],
      disliked: ["Is this a comedy routine? Do I have to pay for that too?", "Save the jokes, kid."],
    },
    point: {
      overgrown: { works: ["Fine, it's tall. Tall grass is free, you know."], fails: ["I cut that myself. With scissors. It's fine."] },
      social_proof: { works: ["Harold pays you? Harold's cheaper than me. That's saying something."] },
      reputation: { works: ["Good reviews mean you won't waste my money. Maybe."], fails: ["Stars don't mow lawns."] },
      free_trial: { works: ["Free? Now you're speaking my language.", "Free is my favorite price."] },
      eco: { works: ["No gas? So no fuel surcharge? Good."], fails: ["Don't care. What's it cost?"] },
      beat_current: { works: ["{rival} raised their prices. Again. Robbery."], fails: ["{rival} is cheap. Can you beat cheap?"] },
    },
    offended: ["HA! For that price you can mow it with gold scissors.", "Are you insane? I've paid less for a car!"],
    steep: ["Too much. Way too much.", "In this economy?", "I buy my bread day-old. Think about that."],
    close: ["Getting warmer. Still too much.", "Close. Now knock off a few bucks."],
    counter: ["{price}. And not a penny more.", "I'll give you {price}. Cash.", "{price}, and I want the clippings for my compost."],
    finalCounter: ["{price}. Final. I've got coupons older than you."],
    accept: ["Fine. Deal. But I'm watching the clock.", "Alright. Don't expect a tip.", "Deal. I'll pay on time. I always pay on time."],
    trial: ["Free first one? Well, I'd be a fool to say no."],
    think: ["I'll think about it. Probably no.", "Leave a flyer. I'll use the back for my grocery list."],
    walkAway: ["Hmph. Good. Saved me some money."],
    slam: ["Out. Go on. Shoo."],
  },

  hoa: {
    greet: [
      "Yes? Do you have a permit to solicit in this subdivision?",
      "Hello. I'm {name}, board secretary. Were you aware of Article 7, Section 3?",
      "Can I help you? That car can't park there more than 20 minutes.",
    ],
    tone: {
      liked: ["Good. Businesslike. Section 4 appreciates that.", "Efficient. I can work with efficient."],
      neutral: ["Proceed.", "Go on. I'm taking notes."],
      disliked: ["I'm not your buddy. I'm a board member.", "Let's keep this professional, shall we?"],
    },
    point: {
      overgrown: { works: ["I'm aware. I wrote myself a violation notice. It was humiliating."], fails: ["My lawn is in full compliance, young man."] },
      social_proof: { works: ["Yes, their lawn improved. I noted it at the last meeting."] },
      reputation: { works: ["A reputable vendor. The board would approve."], fails: ["The board does not work with vendors under four stars."] },
      free_trial: { works: ["A probationary period. Very sensible."] },
      beat_current: { works: ["{rival} has been cited twice. Twice!"], fails: ["{rival} is on the approved vendor list."] },
    },
    steep: ["The board budget would never approve that.", "That exceeds the reasonable cost guideline."],
    close: ["Close. Submit a revised figure.", "Nearly compliant. Nearly."],
    counter: ["I'm authorized to approve {price}.", "The board would accept {price}.", "{price}. Per the guidelines."],
    finalCounter: ["{price}. That is the maximum under the bylaws."],
    accept: ["Approved. I'll add you to the vendor list.", "Motion carried. Welcome aboard.", "Deal. Edges at two inches, please. It's in the bylaws."],
    trial: ["A trial is acceptable. I will file an inspection report."],
    think: ["I'll bring it to the next board meeting. That's in three weeks."],
    walkAway: ["Very well. Please exit the subdivision promptly."],
    slam: ["This conversation is adjourned."],
  },

  techie: {
    greet: [
      "Hey, I'm on mute. You have... about ninety seconds.",
      "Oh, hey. Sorry, is this the package? No? Okay, what's up?",
      "Hi. Sorry, my standup starts in two. Go.",
    ],
    tone: {
      liked: ["Nice, efficient. Love it.", "Okay, straight to the value prop. Good."],
      neutral: ["Sure. What's the pitch?", "Mm-hm. Go on."],
      disliked: ["This feels like a lot of preamble.", "Can we skip to the pricing tier?"],
    },
    point: {
      overgrown: { works: ["Yeah, it's a backlog item. A big one.", "My HOA sent me a JIRA ticket. Basically."], fails: ["The robot mower did it Tuesday. I think."] },
      social_proof: { works: ["Oh, you're the one with the stripes down the street? Social proof. Nice."] },
      reputation: { works: ["High rating, decent sample size. I'm sold on the data."], fails: ["Your rating's kind of mid, not gonna lie."] },
      free_trial: { works: ["Free tier. Love a free tier.", "A free trial, no credit card? Okay."] },
      eco: { works: ["Electric? Nice. Lower emissions, no fumes in my office."] },
      beat_current: { works: ["{rival} keeps showing up during my calls. With a leaf blower."] },
    },
    steep: ["That's enterprise pricing for a consumer product.", "Hm, that doesn't pencil out."],
    close: ["Close. Can we iterate on that number?", "Almost. Ship it a little lower."],
    counter: ["Could you do {price}? I'll set up autopay.", "{price} and I'll sign now.", "How about {price}? I'm optimizing here."],
    finalCounter: ["{price}. That's my ceiling, I have to jump on a call."],
    accept: ["Cool, deal. Send me an invoice. Actually just Venmo me. Wait, the other way.", "Deal. Ship it.", "Great, it's a yes. Sorry, gotta run."],
    trial: ["Free trial, sure. If it looks good I'll convert."],
    think: ["Let me circle back on this. Async.", "Can you send me a deck? I'll review it later."],
    walkAway: ["Okay, cool. I'm back on in thirty seconds anyway."],
    slam: ["Yeah, no. Gotta go. Bye."],
  },

  gardener: {
    greet: [
      "Oh, hello! Mind the hostas, dear.",
      "Hi! Sorry, dirt on my hands. Tomato season.",
      "Hello! Do you know anything about aphids? No? Oh well. What can I do for you?",
    ],
    tone: {
      liked: ["What a lovely way to start. You'd get along with my roses.", "Aren't you nice. Come see my dahlias sometime."],
      neutral: ["Alright, what's this about?", "Sure, go on."],
      disliked: ["Hm. You sound like a man who steps on flower beds."],
    },
    point: {
      overgrown: { works: ["The beds take all my time. The lawn gets the leftovers."], fails: ["That's not overgrown, that's a meadow section. On purpose."] },
      social_proof: { works: ["The Nguyens' lawn has been looking wonderful. That's you?"] },
      reputation: { works: ["People say you're careful. Careful is all I ask."], fails: ["I heard someone lost a whole peony bed. Was that you?"] },
      free_trial: { works: ["A free try. Good. You'll learn where the beds are."] },
      eco: { works: ["A reel mower! Oh, that's how grass should be cut. Clean, like scissors.", "No fumes near my vegetable patch? Wonderful."] },
      beat_current: { works: ["{rival} ran over my irises. My irises!"] },
    },
    steep: ["Oh, that's a lot. Fertilizer isn't cheap, you know.", "Hm, that's more than I spend on bulbs. Almost."],
    close: ["Close. Just a smidge lower.", "Nearly. A little less, and throw in some edging?"],
    counter: ["Would {price} work? You'll never have to trim around a bare patch.", "How about {price}? And stay off the beds.", "{price}, dear?"],
    finalCounter: ["{price}. I have seed catalogs to pay for."],
    accept: ["Wonderful! Rule one: the beds are sacred.", "Deal! Mind the hostas. And the daylilies. And the gnome.", "Lovely. I'll draw you a map of the beds."],
    trial: ["A trial? Alright. But if you touch the tulips, it's over."],
    think: ["Let me think it over while I weed. I do my best thinking weeding."],
    walkAway: ["Oh, alright. Take a tomato."],
    slam: ["Please leave. Carefully. Around the beds."],
  },

  eco: {
    greet: [
      "Hi! Oh, is that a gas mower in your trailer? We need to talk.",
      "Hey there! Want some kombucha? I brew it myself.",
      "Hello, friend! Watch out for the pollinator strip.",
    ],
    tone: {
      liked: ["Ha! I like your energy. Very sustainable.", "Aw, good vibes. Come in. Well, stay out. Good vibes though."],
      neutral: ["Okay, tell me more.", "Sure, go ahead."],
      disliked: ["Hm. That's a very corporate way to talk."],
    },
    point: {
      overgrown: { works: ["I let it grow for the bees, but okay, the city sent a letter."], fails: ["That's a rewilding project, actually."] },
      social_proof: { works: ["Oh, you do the house with the rain barrel? Good people."] },
      reputation: { works: ["Good reviews, good karma. It adds up."] },
      free_trial: { works: ["Free first mow? Okay, show me your methods."] },
      eco: { works: ["A reel mower?! Oh, you are speaking my language!", "No gas, no noise, no fumes? Where have you been all my life?"], fails: ["Hm, eco-ish. I'll take it."] },
      beat_current: { works: ["{rival} uses those two-stroke blowers. The fumes! The noise!"] },
    },
    steep: ["Woah, that's a lot. We're saving for a heat pump."],
    close: ["Close. Can you meet me halfway?"],
    counter: ["Would {price} work? Every two weeks is better for the bees.", "How about {price}?", "{price}, and you can have compost whenever you want."],
    finalCounter: ["{price}. That's what the solar savings cover."],
    accept: ["Yes! A green lawn company. Literally and figuratively!", "Deal! You're gonna love my compost pile."],
    trial: ["A trial? Sure. Leave the clover, though. The bees love it."],
    think: ["Let me meditate on it.", "I'll think about it. Want some kombucha for the road?"],
    walkAway: ["Peace! Stay hydrated."],
    slam: ["Okay, I'm gonna need you to leave. Respectfully."],
  },

  landlord: {
    greet: [
      "Uh, I don't live here. I'm just picking up the rent check. What do you want?",
      "If you're one of the tenants' friends, they're not home.",
      "Yeah? Quick, I've got four more properties to check today.",
    ],
    tone: {
      liked: ["Good. Businesslike. I like that.", "Straight talk. Finally."],
      neutral: ["Go on.", "What's the rate?"],
      disliked: ["I don't need a friend, I need a vendor.", "Save the charm for the tenants."],
    },
    point: {
      overgrown: { works: ["Yeah, the city fined me. Twice. Tenants don't mow.", "It's a liability. I know."], fails: ["The tenant says he did it last week."] },
      social_proof: { works: ["You do the rental two doors down? Good, then you know the drill."] },
      reputation: { works: ["Reliable is all I care about."] },
      free_trial: { works: ["Free first cut? Fine. Saves me a fine."] },
      beat_current: { works: ["{rival} keeps skipping weeks and billing me anyway."] },
    },
    steep: ["I'm not paying that for a rental.", "That's more than the tenants' water bill."],
    close: ["Close. Knock a few bucks off and it's a deal."],
    counter: ["{price}, every other week. That's the budget.", "I'll pay {price}. Invoice me monthly.", "{price}. Take it or leave it."],
    finalCounter: ["{price}. Final. I've got three more of these to deal with."],
    accept: ["Deal. Send the invoice to my email, not here.", "Fine. Just keep the city off my back."],
    trial: ["Free first mow? Fine. Don't bother the tenants."],
    think: ["I'll think about it. I've got bigger problems. Like the gutters."],
    walkAway: ["Whatever. Next."],
    slam: ["No. Get lost."],
  },

  dude: {
    greet: [
      "Duuude. What's up?",
      "Hey man. You want a burger? Grill's still hot.",
      "Oh hey. Sorry, was in the hammock. What's going on?",
      "Yo! Nice shirt. What's up?",
    ],
    tone: {
      liked: ["Ha! You're chill. I like you.", "Haha, nice. Okay, okay, what's the deal?"],
      neutral: ["Right on. Keep going.", "Cool, cool."],
      disliked: ["Whoa, that's a lot of business words, man.", "Bro, relax. It's Saturday. Or whatever day it is."],
    },
    point: {
      overgrown: { works: ["Yeah, I can't find the hammock anymore. It's in there somewhere.", "Bro, a deer lives in there now. Named him Steve."], fails: ["Nah, man, I like it long. It's like, texture."] },
      social_proof: { works: ["You do Brett's place? Brett's lawn is sick, man."] },
      reputation: { works: ["Good reviews? Righteous."] },
      free_trial: { works: ["Free? Dude. Yes."] },
      eco: { works: ["Quiet mower? So I can nap while you mow? Genius."] },
      beat_current: { works: ["{rival} woke me up at 7 AM. On a Sunday, man."] },
    },
    offended: ["Whoa, whoa. Dude. No.", "Bro, that's like, a concert ticket. Every week."],
    steep: ["That's kinda steep, man.", "Ooh, I dunno, dude. That's a lot of burgers."],
    close: ["Close, man. So close.", "Almost, dude. Almost."],
    counter: ["How about {price}? And a burger.", "{price}, man? I'll throw in a cold one. Soda. A cold soda.", "Could you do {price}? Every other week, maybe?"],
    finalCounter: ["{price}, dude. That's all I got in the couch cushions."],
    accept: ["Duuude. Deal. Pound it.", "Heck yeah, man. Welcome to the crew.", "Deal! Just don't mow Steve."],
    trial: ["Free first one? Sick. Go for it, man."],
    think: ["Let me think about it, man. I'm gonna go lie down.", "Maybe, dude. Come back later. Or don't. It's cool."],
    walkAway: ["Later, dude. Grill's always on."],
    slam: ["Not cool, man. Not cool."],
  },

  veteran: {
    greet: [
      "Good morning. State your business.",
      "Son. What can I do for you?",
      "At ease. What's this about?",
    ],
    tone: {
      liked: ["Straight talk. Good. I respect that.", "Firm handshake. I like you already."],
      neutral: ["Continue.", "Go on."],
      disliked: ["Is that supposed to be funny?", "Don't waste my time with small talk, son."],
    },
    point: {
      overgrown: { works: ["My back's not what it used to be. I'll admit that."], fails: ["That lawn is regulation length. I cut it Thursday. Oh-seven-hundred."] },
      social_proof: { works: ["Walter's lawn looked sharp. Squared away."] },
      reputation: { works: ["A good record matters."], fails: ["Your record has some black marks, son."] },
      free_trial: { works: ["An inspection run. Fair enough."] },
      beat_current: { works: ["{rival} has no discipline. Crooked lines."] },
    },
    steep: ["That's too much. I didn't serve twenty years to throw money away."],
    close: ["Close. Tighten it up."],
    counter: ["{price}. Weekly. Straight lines.", "I'll pay {price}. That's fair.", "{price}, son."],
    finalCounter: ["{price}. That's final, soldier."],
    accept: ["Deal. Lines parallel to the street. Don't make me show you.", "You're hired. Don't let me down.", "Deal. Firm handshake. Good."],
    trial: ["A trial. Fine. Consider it basic training."],
    think: ["I'll consider it. Dismissed."],
    walkAway: ["Carry on, then."],
    slam: ["We're done here. Off the property."],
  },

  newcouple: {
    greet: [
      "Hi! Sorry about the boxes. We just moved in!",
      "Oh, hi! Are you a neighbor? Welcome! Wait, we're the new ones.",
      "Hello! Is this about the lawn? Please say it's about the lawn.",
    ],
    tone: {
      liked: ["Oh, you're so nice! See, honey, the neighborhood is nice.", "Ha! That's great. Okay, tell us everything."],
      neutral: ["Okay! What's up?", "Sure, go ahead."],
      disliked: ["Oh. Um, okay. That was kind of intense."],
    },
    point: {
      overgrown: { works: ["We didn't know it grows this fast! Nobody told us!", "We don't even own a mower. Is that bad?"], fails: ["Oh, we just had it done. Is it bad already?"] },
      social_proof: { works: ["The neighbors use you? We were gonna ask them who does their lawn!"] },
      reputation: { works: ["Great reviews! We read every review before buying this house. It is kind of our thing."] },
      free_trial: { works: ["Free first mow? That's so nice. Honey, it's free!"] },
      eco: { works: ["Electric? Oh, that's great. We're trying to be more green."] },
      beat_current: { works: ["The last owners used {rival}. The lawn looked sad."] },
    },
    steep: ["Oh wow. We just bought a house. We're kind of broke.", "Yikes. The closing costs were a lot."],
    close: ["That's close! Can you do a bit less?"],
    counter: ["Could you do {price}? The mortgage is a lot.", "How about {price}?", "{price}? Our budget spreadsheet has a whole tab for this."],
    finalCounter: ["{price} is really the most we can do right now."],
    accept: ["Yay! Our first lawn guy! Honey, we have a lawn guy!", "Deal! This is so grown-up of us.", "Yes! Deal! Sorry, we're excited."],
    trial: ["A free trial? Perfect. We'll take pictures for the group chat."],
    think: ["We need to talk about it. Can we let you know?", "Can we think about it? We have like forty decisions this week."],
    walkAway: ["Okay, bye! Thanks for stopping by!"],
    slam: ["Um. We're good, thanks."],
  },

  executive: {
    greet: [
      "Yes? My assistant usually handles this.",
      "Hello. I'm taking this call between two others. Make it brief.",
      "Can I help you? The gate is supposed to keep people out.",
    ],
    tone: {
      liked: ["Polished. I appreciate that.", "Good. You understand how business works."],
      neutral: ["Go on.", "I'm listening. Briefly."],
      disliked: ["I don't do casual.", "Is this a joke? I don't have time for jokes."],
    },
    point: {
      overgrown: { works: ["The last service quit mid-season. It's an embarrassment for the gala."], fails: ["The lawn was serviced yesterday by a crew of six."] },
      social_proof: { works: ["The Ashfords recommended you? They are very particular."] },
      reputation: { works: ["A strong reputation. That's what I pay for."], fails: ["I only hire the best. Your numbers say you aren't that. Yet."] },
      free_trial: { works: ["A complimentary visit. Fine. Consider it an interview."] },
      eco: { fails: ["I don't care what it runs on. I care how it looks."] },
      beat_current: { works: ["{rival} has become careless. I've noticed."], fails: ["{rival} does excellent work. You'd have to be exceptional."] },
    },
    offended: ["That's not a price, that's a ransom note.", "I didn't get here by paying numbers like that."],
    steep: ["I expect value, not a markup.", "That's ambitious."],
    close: ["Close. Sharpen your pencil.", "Nearly. Don't round up."],
    counter: ["{price}. My accountant would approve.", "I'll authorize {price}.", "{price}. Per visit. With stripes."],
    finalCounter: ["{price}. That's the number. I won't revisit it."],
    accept: ["Fine. You're hired. Stripes, weekly. Don't disappoint me.", "Deal. My assistant will send the details.", "Agreed. The lawn is the first thing guests see."],
    trial: ["One complimentary visit. If it's perfect, the account is yours."],
    think: ["Send me a proposal. I'll have someone review it."],
    walkAway: ["Very well."],
    slam: ["I think we're done. Security will see you out."],
  },

  facilities: {
    greet: ["Hi. Facilities. Is this about the RFP?", "You're the lawn vendor? Take a seat. Not that one, it's broken.", "Hello. I have eleven minutes before the fire drill. Go."],
    tone: {
      liked: ["Good, professional. Makes my job easier."],
      neutral: ["Okay. Walk me through it."],
      disliked: ["This isn't really a joking environment."],
    },
    accept: ["Deal. I'll get purchasing to issue a PO.", "Approved. Welcome to the vendor list."],
    counter: ["The budget line is {price}.", "I can do {price} under the current contract."],
    steep: ["That's way over the budget line."],
    close: ["Close. I need it under the approval threshold."],
    think: ["I'll need to run it by procurement."],
  },

  parks: {
    greet: ["Hey there! Parks department. What can I do for you?", "Hi! Sorry, just got back from the ball fields. What's up?", "Hello! Mind the geese. They run this place, honestly."],
    tone: {
      liked: ["Ha! Good to meet you.", "Great, I like working with people like you."],
      neutral: ["Okay, go ahead."],
      disliked: ["Hm. Let's keep it simple, okay?"],
    },
    accept: ["Deal! The Little League will be thrilled.", "Approved. Try not to hit the sprinkler heads."],
    counter: ["The city can do {price}.", "{price}. That's what the council approved."],
    steep: ["The taxpayers would riot."],
    close: ["Close! Just under that and I can sign."],
    think: ["I'll take it to the council."],
  },

  greenskeeper: {
    greet: ["You. The mowing company. Walk with me. Don't step on the green.", "Morning. What's your cut height on a fairway reel?", "If you're here about the job, you already know about the bentgrass. Right?"],
    tone: {
      liked: ["Straight answers. Good. This is a golf course, not a picnic."],
      neutral: ["Go on."],
      disliked: ["Don't. Just... don't."],
    },
    accept: ["Deal. Half an inch. Not a hair more.", "You're on. Don't make me regret it."],
    counter: ["{price}. That's the club's number.", "The board approved {price}."],
    steep: ["The members would never approve that."],
    close: ["Close. Tighten it up."],
    think: ["I'll talk to the club board."],
  },
};

// ---------------------------------------------------------------- the player's lines
export const PLAYER = {
  tone: {
    friendly: [
      "Hi there! I'm with {company}. Beautiful day, isn't it?",
      "Hey! Hope I'm not interrupting. I'm from {company}, I mow lawns around {street}.",
      "Hi! Love the front porch. I'm with {company}, the lawn folks.",
    ],
    professional: [
      "Hello. I'm with {company}. We provide weekly lawn care on {street}.",
      "Hello. {company}, lawn maintenance. Do you have a minute to talk about your yard?",
      "Good day. I represent {company}. We offer scheduled mowing, trimming and cleanup.",
    ],
    direct: [
      "Hi. I mow lawns. I'd like to mow yours.",
      "Hey. {company}. Your lawn, my mower, fair price. Interested?",
      "I'll keep it short: I can take the lawn off your hands every week.",
    ],
    funny: [
      "Hi! I'm here to rescue your lawn. It sent a distress signal.",
      "Hello! Your grass called. It wants a haircut.",
      "Hi! I'm with {company}. We put the mow in money. Wait. Other way around.",
    ],
  } as Record<'friendly' | 'professional' | 'direct' | 'funny', string[]>,
  point: {
    overgrown: [
      "I couldn't help noticing the grass is getting pretty tall. About {grass} now.",
      "Looks like the lawn's gotten a head start on you this week.",
    ],
    social_proof: [
      "I already take care of a few lawns right here on {street}.",
      "You might have seen the stripes a few doors down. That's our work.",
    ],
    reputation: [
      "Our clients rate us pretty well. Happy to share the reviews.",
      "We've built a solid reputation around town.",
    ],
    free_trial: [
      "Tell you what: first mow is on me. If you don't love it, you owe nothing.",
      "I'll do the first one free. No strings.",
    ],
    eco: [
      "We use a quiet, zero-emission mower. No fumes, no noise.",
      "No gas engine on this job. Clean cut, clean air.",
    ],
    beat_current: [
      "I see {rival} does your lawn. I think we can do better.",
      "If you're not happy with {rival}, I'd love a shot.",
    ],
  } as Record<PointId, string[]>,
  offerWeekly: [
    "I can do {price} per mow, every week.",
    "How about {price} a visit, weekly?",
    "{price} a mow, once a week. Trim and cleanup included.",
  ],
  offerBiweekly: [
    "I can do {price} per mow, every two weeks.",
    "How about {price} a visit, every other week?",
  ],
  addOnsSuffix: " That includes {addons}.",
  acceptCounter: [
    "{price} works. Deal.",
    "You've got a deal at {price}.",
    "Alright, {price} it is.",
  ],
  trial: [
    "First mow free at {price} after that. If you don't love it, no hard feelings.",
    "Let me do the first one free. After that it's {price}.",
  ],
  walkAway: [
    "Thanks for your time. Have a good one.",
    "No worries. Enjoy your day.",
    "I'll leave you to it. Thanks.",
  ],
};

// ---------------------------------------------------------------- at the door, before the pitch
export const NOBODY_HOME = [
  "The porch light is off.",
  "A dog barks inside. Nobody comes.",
  "You hear a TV, then it goes quiet. Nobody comes.",
  "The blinds twitch. Nobody comes.",
  "No answer. A cat stares at you from the window.",
  "No answer. There's a package on the mat from three days ago.",
  "The doorbell plays a little tune. Nobody comes.",
  "A wind chime answers. Nobody else does.",
];

export const NO_SOLICITING = [
  "NO SOLICITING. This means you.",
  "No soliciting. No flyers. No exceptions.",
  "Private residence. No solicitors, please.",
  "No soliciting. Beware of dog. The dog is very small but has opinions.",
];

export const COLD_LINES = [
  "They said they'd think about it.",
  "They wanted a few days to think.",
];

// ---------------------------------------------------------------- lookup
export function linesFor(archetypeId: string): LineSet {
  const a = ARCHETYPE_LINES[archetypeId] ?? {};
  return {
    ...GENERIC,
    ...a,
    tone: { ...GENERIC.tone, ...(a.tone ?? {}) },
    point: { ...GENERIC.point, ...(a.point ?? {}) },
  } as LineSet;
}

export function fill(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined || v === '' ? m : String(v);
  });
}
