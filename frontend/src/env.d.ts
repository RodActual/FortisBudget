// This tells the editor that importing .css files is perfectly fine.
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}