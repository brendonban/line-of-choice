/* Shared content for the site, the game and the admin console.
   Scenario ids are stable keys used in stored session data — add new ones, don't renumber. */
window.EHP = {
  LEVELS: [
    { n: 5, name: "Automated Response", xp: 0,    desc: "Habits run the show. You still choose sometimes, but defaults usually win in the moment." },
    { n: 4, name: "Recognition",        xp: 450,  desc: "You start to notice you have a choice in every response, and catch yourself more often." },
    { n: 3, name: "Social Value",       xp: 1300, desc: "More balanced and less self-focused. Your attention turns to the people around you." },
    { n: 2, name: "Wisdom",             xp: 2600, desc: "Long stretches of presence. People around you feel the difference." },
    { n: 1, name: "Presence",           xp: 4400, desc: "A quiet mind, fully in the now. Total freedom to choose." },
  ],

  SCENARIOS: [
    { id: "s01", t: "A car cuts in front of you on the highway.", good: "Breathe out and give them space", bad: "Horn, high beam and a few words", tag: "automatic" },
    { id: "s02", t: "Your group-assignment teammate hasn't done their part. It's due tomorrow.", good: "Message them: what's stopping you? Can we split it?", bad: "Complain about them in another group chat", tag: "blame" },
    { id: "s03", t: "Your lecturer's comments on your essay are harsh.", good: "Ask which part to work on first", bad: "Decide the lecturer just doesn't like you", tag: "justify" },
    { id: "s04", t: "Your parents compare you with your cousin. Again.", good: "Notice the sting, then say how it lands for you", bad: "Snap back and storm off", tag: "defend" },
    { id: "s05", t: "Your supervisor at your part-time job points out a mistake.", good: "Own it and ask how to fix it", bad: "Say nobody trained you properly", tag: "justify" },
    { id: "s06", t: "A friend has left your message on read for two days.", good: "Check in: “Hey, you OK?”", bad: "Assume they're ignoring you and go cold", tag: "automatic" },
    { id: "s07", t: "You've been struggling for weeks. A friend asks how you are.", good: "Tell them the truth, even a little", bad: "Say “I'm fine” and change the topic", tag: "deny" },
    { id: "s08", t: "Your results are worse than you hoped.", good: "Feel it, then plan one next step", bad: "Say the paper was unfair anyway", tag: "justify" },
    { id: "s09", t: "Someone posts a joke about you in the class group chat.", good: "Pause before replying, or talk to them in person", bad: "Fire back a sharper joke", tag: "automatic" },
    { id: "s10", t: "You missed a form deadline.", good: "Email the office, own it, ask what's possible", bad: "Blame the confusing portal", tag: "blame" },
    { id: "s11", t: "Your housemate leaves the dishes in the sink. Again.", good: "Raise it calmly and agree a plan", bad: "Leave a passive-aggressive note", tag: "automatic" },
    { id: "s12", t: "You're running late to meet friends.", good: "Text early and apologise, no long excuse", bad: "Arrive with a long story about traffic", tag: "justify" },
    { id: "s13", t: "Your idea gets ignored in a club meeting.", good: "Ask what they'd need to consider it", bad: "Go quiet and stop contributing", tag: "defend" },
    { id: "s14", t: "A family member says you're on your phone too much.", good: "Put it down and ask what they need", bad: "Say you're not, you're just replying to something", tag: "deny" },
    { id: "s15", t: "You're scrolling and everyone else seems to be doing better.", good: "Close the app and name what you feel", bad: "Keep scrolling and decide you're behind", tag: "automatic" },
    { id: "s16", t: "Your internship manager says the slides aren't ready.", good: "Say what's done and when the rest will be", bad: "Say the brief changed too many times", tag: "justify" },
    { id: "s17", t: "Your sibling borrows your things without asking.", good: "Tell them how it affects you", bad: "Take something of theirs in return", tag: "blame" },
    { id: "s18", t: "You feel overwhelmed and can't focus all week.", good: "Reach out to someone you trust", bad: "Push through alone and say nothing", tag: "deny" },
  ],

  ITEMS: [
    { k: "notice", t: "I notice when I'm reacting on autopilot (blaming, defending, denying or justifying)." },
    { k: "pause",  t: "When I'm upset, I can pause before I respond." },
    { k: "own",    t: "I take responsibility for how I respond, even when the situation isn't my fault." },
    { k: "help",   t: "I feel at ease reaching out for support when I need it." },
  ],
  SCALE: ["Strongly disagree", "Disagree", "Not sure", "Agree", "Strongly agree"],
  AGES: ["Under 18", "18–20", "21–24", "25–29", "30 or over", "Prefer not to say"],
};
