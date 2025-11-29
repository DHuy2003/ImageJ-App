import './ProgressDialog.css';

interface ProgressDialogProps {
    isOpen: boolean;
    title?: string;
    message?: string;
}

const ProgressDialog = ({ isOpen, title = 'Đang xử lý', message = 'Vui lòng chờ...' }: ProgressDialogProps) => {
    if (!isOpen) return null;

    return (
        <div className="progress-dialog-overlay">
            <div className="progress-dialog">
                <div className="progress-spinner" aria-hidden="true" />
                <div className="progress-text">
                    <h4>{title}</h4>
                    <p>{message}</p>
                </div>
            </div>
        </div>
    );
};

export default ProgressDialog;
