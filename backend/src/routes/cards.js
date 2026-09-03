async function movePcoWorkflowCard({ cardPcoId, targetStepPcoId }) {
  const appId = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;

  const response = await fetch(
    `https://api.planningcenteronline.com/people/v2/workflow_cards/${cardPcoId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: "WorkflowCard",
          id: cardPcoId,
          relationships: {
            step: {
              data: { 
                type: "WorkflowStep", 
                id: targetStepPcoId 
              }
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PCO API ${response.status}: ${text}`);
  }
}