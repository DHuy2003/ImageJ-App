import './ImageView.css';

const ImageView = () => {
  return (
    <div id="image-view">
      <div id="image-properties">
        <h2>Properties</h2>
        <p>Name: </p>
        <p>Type: </p>
        <p>Format: </p>
        <p>Size: </p>
      </div>

      <div id="image-container">
        <div id="image-controls">
          <button id="prev-frame">Previous Frame</button>
          <button id="next-frame">Next Frame</button>
        </div>

        <div id='image-display'>

        </div>
        
        <p>Frame 1 of 1</p>
      </div>

      <div id="image-gallery">
        <h2>Gallery</h2>
        
      </div>

    </div>
  );
}
export default ImageView;