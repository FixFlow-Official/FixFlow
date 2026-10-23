import ExpandableComplaintCard from "../../components/complaints/ExpandableComplaintCard.jsx";

/** Student-facing complaint summary used on the dashboard and list page. */
export default function StudentComplaintCard({
  complaint,
  onOpen,
  onDownload,
}) {
  return (
    <ExpandableComplaintCard
      complaint={complaint}
      expanded={false}
      onToggle={() => onOpen(complaint)}
      onDownloadPdf={onDownload}
      summary="Select to view the complete complaint and its status history."
    />
  );
}
