import absLogoIcon from '../assets/abs-logo-icon.png';

/**
 * Full-screen branded loader used for route and auth transitions.
 * @param {object} props
 * @param {string} [props.label='Loading...'] - Loader status text.
 * @returns {JSX.Element}
 */
const AppLoader = ({ label = 'Loading...' }) => {
  return (
    <div className="app-loader-root" role="status" aria-live="polite" aria-label={label}>
      <div className="app-loader-backdrop" />
      <div className="app-loader-content">
        <div className="app-loader-ring" aria-hidden="true" />
        <div className="app-loader-logo-shell">
          <img src={absLogoIcon} alt="ABS logo" className="app-loader-logo" />
        </div>
        <p className="app-loader-label">{label}</p>
        <div className="app-loader-progress" aria-hidden="true">
          <span className="app-loader-progress-glint" />
        </div>
      </div>
    </div>
  );
};

export default AppLoader;
