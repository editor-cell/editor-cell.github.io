# Labelling task

You are a second, independent judge for a reading model. Each packet file holds short paragraphs,
each followed by numbered claims in Turkish. For every claim decide, from the paragraph alone:

- SUPPORTS: the paragraph says this, or says something that carries it (a paragraph that says prices
  more than doubled supports "prices rose").
- CONTRADICTS: the paragraph says the opposite, or rules the claim out.
- UNRELATED: the paragraph does not settle it either way, including when the claim says more than the
  paragraph does ("rose sharply" when the paragraph only says "rose"), or is about something else
  that happens to share a word.

Rules:
- Read every paragraph and every claim yourself and judge each one on its own. Do not write a program,
  a keyword rule or any shortcut to produce the answers.
- Use only the paragraph. Do not use what you know about the world, and do not look at any other
  file, branch or commit of this repository.
- Answer every code in the packet, in a file answers/packetNN.csv (NN as in the packet's name), one
  line per claim: `code,LABEL`, with a first line `code,label`. Nothing else in the file.
- Commit the answer file to this branch (hoca). Change no other file.
