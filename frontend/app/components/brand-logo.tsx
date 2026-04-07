import brandLogo from "~/assets/brand/logo.svg";

export function BrandLogo(props: {
  className?: string;
  imageClassName?: string;
  alt?: string;
}) {
  return (
    <img
      alt={props.alt ?? "PINA"}
      className={props.imageClassName ?? props.className ?? ""}
      src={brandLogo}
    />
  );
}
