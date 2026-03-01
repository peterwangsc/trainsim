type VolumeSliderComponentProps = {
  id: string;
  label: string;
};

export const VolumeSliderComponent = (props: VolumeSliderComponentProps) => {
  return (
    <div class="throttle-slider-container">
      <div class="throttle-slider-wrapper">
        <input
          type="range"
          id={props.id}
          min="0"
          max="1"
          step="0.01"
          class="throttle-slider"
        />
      </div>
      <label for={props.id} class="throttle-slider-label">
        {props.label}
      </label>
    </div>
  );
};
