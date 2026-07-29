/**
 * Appends an actionable association hint to a tool result when the network
 * returns TOKEN_NOT_ASSOCIATED_TO_ACCOUNT.
 *
 * Shared by all HTS token transfer tools so the guidance is consistent and
 * maintained in a single place.
 */
export function appendTokenAssociationHint(result: any): any {
  if (result?.raw?.errorCode === 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT') {
    result.humanMessage +=
      ' The recipient account has not associated this HTS token.' +
      ' Use the associate_token_tool to associate the account first,' +
      ' or ensure the account has maxAutoAssociations set to -1.';
  }
  return result;
}
