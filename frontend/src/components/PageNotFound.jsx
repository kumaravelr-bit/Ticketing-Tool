import { useNavigate } from "react-router-dom";
import styles from "../css/PageNotFound.module.css";

export default function PageNotFound() {
  const navigate = useNavigate();

  const handleRedirect = () => {
    const token = localStorage.getItem("token");

    if (token) {
      navigate("/active");   // logged in
    } else {
      navigate("/login");    // not logged
    }
  };

  return (
    <section className={styles.page_404}>
      <div className={styles.container}>
        <div className={styles.contentWrapper}>

          <div className={styles.four_zero_four_bg}>
            <h1>404</h1>
          </div>

          <div className={styles.contant_box_404}>
            <h3>Look like you're lost</h3>

            <p>The page you are looking for is not available!</p>

            <button
              className={styles.link_404}
              onClick={handleRedirect}
            >
              Go to Home
            </button>

          </div>

        </div>
      </div>
    </section>
  );
}