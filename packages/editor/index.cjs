function buildExtensions(
  placeholder,
  {
    Image,
    Link,
    Placeholder,
    Underline,
    StarterKit,
    Table,
    TableRow,
    TableCell,
    TableHeader,
  },
) {
  const DayflowImage = Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        "data-local-id": {
          default: null,
          parseHTML: (el) => el.getAttribute("data-local-id"),
          renderHTML: (attrs) =>
            attrs["data-local-id"]
              ? { "data-local-id": attrs["data-local-id"] }
              : {},
        },
      };
    },
  });
  const cells = (node) =>
    node.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          align: {
            default: null,
            parseHTML: (el) =>
              ["left", "center", "right"].includes(
                el.getAttribute("align") || el.style.textAlign,
              )
                ? el.getAttribute("align") || el.style.textAlign
                : null,
            renderHTML: (attrs) => (attrs.align ? { align: attrs.align } : {}),
          },
        };
      },
    });
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: {} }),
    Underline,
    Link.configure({
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
    DayflowImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder }),
    ...(Table
      ? [
          Table.configure({
            resizable: false,
            renderWrapper: true,
            cellMinWidth: 180,
          }),
          TableRow,
          cells(TableCell),
          cells(TableHeader),
        ]
      : []),
  ];
}
module.exports = {
  buildExtensions,
  ALLOWED_IMAGE_TYPES: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
};
