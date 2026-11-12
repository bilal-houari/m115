// The project function defines how your document looks.
// It takes your content and some metadata and formats it.
// Go ahead and customize it to your liking!
#let project(title: "", authors: (), date: none, body) = {
  // Set the document's basic properties.
  set document(author: authors.map(a => a.name), title: title)
  set page(
    margin: (left: 25mm, right: 25mm, top: 30mm, bottom: 30mm),
    numbering: "1",
    number-align: end,
  )

  // Save heading and body font families in variables.
  let body-font = "Libertinus Serif"
  let sans-font = "Libertinus Sans"

  // Set body font family.
  set text(font: body-font, lang: "fr")

  // Set paragraph spacing.
  set par(spacing: 1.2em)

  show heading: set text(font: sans-font)
  set par(leading: 0.75em)

  // Title row.
  align(center)[
    #block(text(font: sans-font, weight: 700, 1.75em, title))
    #v(1.2em, weak: true)
    #date
  ]

  // Author information.
  pad(
    top: 0.8em,
    bottom: 0.8em,
    x: 2em,
    grid(
      columns: (1fr,) * calc.min(3, authors.len()),
      gutter: 1em,
      ..authors.map(author => align(center)[
        *#author.name* \
        #author.email \
        #author.affiliation
      ]),
    ),
  )

  // Main body.
  set par(justify: true)
  set text(hyphenate: false)

  body
}
