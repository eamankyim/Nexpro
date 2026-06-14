import EmailVerificationPrompt from './EmailVerificationPrompt';
import { PageShell } from './StorefrontLayout';

const AccountLayout = ({
  title,
  description,
  children,
  activePath = '/account',
  showVerificationPrompt = true,
}) => {
  return (
    <PageShell
      activePath={activePath}
      appMode
      buyerTitle={title}
      buyerDescription={description}
    >
      {showVerificationPrompt ? <EmailVerificationPrompt /> : null}
      {children}
    </PageShell>
  );
};

export default AccountLayout;
