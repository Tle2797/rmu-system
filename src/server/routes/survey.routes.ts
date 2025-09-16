import { Elysia, t } from "elysia";
import { getQuestionsBySurveyId } from "../controllers/survey.controller";

const surveyRoutes = new Elysia();

surveyRoutes.get(
  "/surveys/:id/questions",
  async ({ params }) => {
    return await getQuestionsBySurveyId(Number(params.id));
  },
  {
    params: t.Object({
      id: t.String(),
    }),
  }
);

export default surveyRoutes;
