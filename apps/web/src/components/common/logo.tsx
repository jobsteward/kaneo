import { Link } from "@tanstack/react-router";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      <img
        src={`${import.meta.env.BASE_URL}logo-dark.svg`}
        alt="Kaneo"
        className="h-6 w-auto dark:hidden"
      />
      <img
        src={`${import.meta.env.BASE_URL}logo-light.svg`}
        alt="Kaneo"
        className="hidden h-6 w-auto dark:block"
      />
    </Link>
  );
}
