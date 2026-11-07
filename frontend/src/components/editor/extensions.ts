import { Extension, type AnyExtension, type Extensions } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { buildExtensions as sharedExtensions } from "@dayflow/editor";
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@dayflow/editor";
export function buildExtensions(
  placeholder: string,
  onLimit?: () => void,
): Extensions {
  const limits = Extension.create({
    name: "tableLimits",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction(tr) {
            if (!tr.docChanged) return true;
            let valid = true,
              cells = 0;
            tr.doc.descendants((node) => {
              if (node.type.name !== "table") return true;
              const map = TableMap.get(node);
              cells += map.width * map.height;
              let nested = false;
              node.descendants((child) => {
                if (child.type.name === "table") nested = true;
              });
              if (map.width > 40 || map.height > 200 || cells > 2_000 || nested)
                valid = false;
              return false;
            });
            if (!valid) queueMicrotask(() => onLimit?.());
            return valid;
          },
        }),
      ];
    },
  });
  return [
    ...sharedExtensions<AnyExtension>(placeholder, {
      Image,
      Link,
      Placeholder,
      Underline,
      StarterKit,
      Table,
      TableRow,
      TableCell,
      TableHeader,
    }),
    limits,
  ];
}
