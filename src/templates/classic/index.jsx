import ProfessionalTemplate from "../professional";

export default function ClassicTemplate({ resume, ctx }) {
  return (
    <ProfessionalTemplate
      resume={resume}
      ctx={{ ...ctx, templateVariant: "classic" }}
    />
  );
}
