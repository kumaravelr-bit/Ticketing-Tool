

export default function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange
}) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination manpower-pagination">
      <button
        type="button"
        className="manpower-page-btn"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </button>

      <span className="manpower-page-number">{page}</span>

      <button
        type="button"
        className="manpower-page-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}