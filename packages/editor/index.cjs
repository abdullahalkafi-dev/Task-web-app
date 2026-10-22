function buildExtensions(placeholder, {Image, Link, Placeholder, Underline, StarterKit}) {
  const DayflowImage = Image.extend({ addAttributes() { return { ...this.parent?.(), 'data-local-id': { default: null, parseHTML: el => el.getAttribute('data-local-id'), renderHTML: attrs => attrs['data-local-id'] ? { 'data-local-id': attrs['data-local-id'] } : {} } }; } });
  return [StarterKit.configure({heading:{levels:[1,2,3]},codeBlock:{}}), Underline, Link.configure({autolink:true,openOnClick:false,HTMLAttributes:{target:'_blank',rel:'noopener noreferrer nofollow'}}), DayflowImage.configure({inline:false,allowBase64:false}), Placeholder.configure({placeholder})];
}
module.exports = { buildExtensions, ALLOWED_IMAGE_TYPES:['image/png','image/jpeg','image/webp','image/gif'], MAX_IMAGE_BYTES:10*1024*1024 };
