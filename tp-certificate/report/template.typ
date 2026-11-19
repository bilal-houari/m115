// Simple report layout, adapted from the Mini Social Media TP report.
#let project(title: "", authors: (), date: none, body) = {
  set document(author: authors.map(a => a.name), title: title)
  set page(
    margin: (left: 25mm, right: 25mm, top: 30mm, bottom: 30mm),
    numbering: "1",
    number-align: end,
  )

  let body-font = "Libertinus Serif"
  let sans-font = "Libertinus Sans"
  set text(font: body-font, lang: "fr")
  set par(spacing: 1.2em)
  show heading: set text(font: sans-font)
  set par(leading: 0.75em)

  align(center)[
    #block(text(font: sans-font, weight: 700, 1.75em, title))
    #v(1.2em, weak: true)
    #date
  ]

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

  set par(justify: true)
  set text(hyphenate: false)
  body
}
