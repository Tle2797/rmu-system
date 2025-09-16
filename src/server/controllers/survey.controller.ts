import { db } from "../db.config";

export const getQuestionsBySurveyId = async (surveyId: number) => {
  const rows = await db.any(
    `SELECT 
       id, 
       survey_id, 
       text, 
       LOWER(TRIM(type)) AS type
     FROM questions 
     WHERE survey_id = $1 
     ORDER BY id ASC`,
    [surveyId]
  );
  return rows;
};
