type IntroSplashComponentProps = {
  logoSrc: string;
};

export const IntroSplashComponent = (props: IntroSplashComponentProps) => {
  return (
    <div class="intro-splash" aria-hidden="true">
      <img
        class="intro-splash__logo"
        src={props.logoSrc}
        alt="TrainSim"
        decoding="async"
        loading="eager"
      />
    </div>
  );
};
